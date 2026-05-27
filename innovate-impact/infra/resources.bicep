// =====================================================================
// Workshop Buddy — resource group scoped resources.
// =====================================================================
targetScope = 'resourceGroup'

@minLength(1)
param environmentName string

@minLength(1)
param location string

@minLength(1)
param resourceToken string

param principalId string

param pgServerLocation string
param foundryLocation string
param foundryModelName string
param foundryModelVersion string
param foundryModelSku string
param foundryModelCapacity int

param webAppImage string
param appTargetPort int

// --- naming (all derived, globally unique where required) ---------------
var acrName = toLower(replace('wb${resourceToken}acr', '-', ''))
var lawName = 'wb-${resourceToken}-law'
var envName = 'wb-${resourceToken}-env'
var appName = 'wb-${resourceToken}-app'
var uamiName = 'wb-${resourceToken}-uami'
var pgAdminLogin = 'workshop-buddy-uami'
var pgToken = toLower(uniqueString(subscription().id, environmentName, pgServerLocation))
var pgServerName = 'pg-wb-${take(pgToken, 8)}'
var pgDatabaseName = 'workshopbuddy'
var foundryAccountName = 'wb-${resourceToken}-foundry'

var tags = {
  'azd-env-name': environmentName
}

// --- User-Assigned Managed Identity ------------------------------------
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: uamiName
  location: location
  tags: tags
}

// --- Container Registry -------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
  tags: tags
}

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
resource acrPullForUami 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, uami.id, acrPullRoleId)
  properties: {
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

// AcrPush for the principal running `azd up` so `az acr build` succeeds.
var acrPushRoleId = '8311e382-0749-4cb8-b61a-304f252e45ec'
resource acrPushForPrincipal 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  scope: acr
  name: guid(acr.id, principalId, acrPushRoleId)
  properties: {
    principalId: principalId
    principalType: 'User'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPushRoleId)
  }
}

// --- Azure AI Foundry account + model deployment ------------------------
resource foundry 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: foundryAccountName
  location: foundryLocation
  kind: 'AIServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: foundryAccountName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
  tags: tags
}

resource foundryDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: foundry
  name: foundryModelName
  sku: {
    name: foundryModelSku
    capacity: foundryModelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: foundryModelName
      version: foundryModelVersion
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
}

// Cognitive Services User for the workload UAMI on the Foundry account.
var cogSvcUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'
resource foundryUserForUami 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: foundry
  name: guid(foundry.id, uami.id, cogSvcUserRoleId)
  properties: {
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cogSvcUserRoleId)
  }
}

// --- Postgres Flexible Server (Entra-only auth) ------------------------
resource pgServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: pgServerName
  location: pgServerLocation
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
      tenantId: subscription().tenantId
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
  tags: tags
}

resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: pgServer
  name: pgDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource pgFwAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: pgServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Postgres Entra admins (workload UAMI + deploying user) are assigned by the
// `azd postprovision` hook via `az postgres flexible-server ad-admin create`.
// Bicep's `flexibleServers/administrators` resource requires the principalId
// as the resource name, which must be known at compile-time — using a runtime
// reference to `uami.properties.principalId` fails BCP120.

// --- Log Analytics + ACA Environment -----------------------------------
resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: lawName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
  tags: tags
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
  tags: tags
}

// --- Container App ------------------------------------------------------
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  dependsOn: [
    acrPullForUami
  ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uami.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: appTargetPort
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: uami.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webAppImage
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: string(appTargetPort) }
            { name: 'HOSTNAME', value: '0.0.0.0' }
            { name: 'DATABASE_URL', value: 'postgresql://${pgAdminLogin}@${pgServer.properties.fullyQualifiedDomainName}:5432/${pgDatabaseName}?sslmode=require' }
            { name: 'APP_NAME', value: 'Workshop Buddy' }
            { name: 'AI_PROVIDER', value: 'azure_foundry' }
            { name: 'AZURE_FOUNDRY_RESPONSES_ENDPOINT', value: '${foundry.properties.endpoint}openai/v1/responses' }
            { name: 'AZURE_FOUNDRY_MODEL', value: foundryModelName }
            { name: 'AZURE_CLIENT_ID', value: uami.properties.clientId }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scale'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
}

// --- outputs ------------------------------------------------------------
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output appName string = app.name
output appFqdn string = app.properties.configuration.ingress.fqdn
output appUri string = 'https://${app.properties.configuration.ingress.fqdn}'
output pgServerName string = pgServer.name
output pgServerFqdn string = pgServer.properties.fullyQualifiedDomainName
output pgDatabaseName string = pgDb.name
output foundryAccount string = foundry.name
output foundryEndpoint string = foundry.properties.endpoint
output foundryResponsesEndpoint string = '${foundry.properties.endpoint}openai/v1/responses'
output uamiName string = uami.name
output uamiClientId string = uami.properties.clientId
output uamiPrincipalId string = uami.properties.principalId
