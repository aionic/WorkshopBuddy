// =====================================================================
// Workshop Buddy - Azure Container Apps deployment
// Target: resource group "rgWorkshopBuddy"
//
// Strategy:
//   - Bootstrap pass (deployApp=false) creates ACR, Log Analytics,
//     ACA env, storage + file share, and a User-Assigned Managed
//     Identity (UAMI) that is granted AcrPull on the new ACR and
//     Cognitive Services User on the Foundry account (in another RG).
//     Role assignments propagate while `az acr build` is running.
//   - Final pass (deployApp=true) deploys the Container App,
//     attaching the same UAMI for both ACR pulls and Foundry calls.
// =====================================================================

targetScope = 'resourceGroup'

@description('Base name used to derive resource names.')
param baseName string = 'workshopbuddy'

@description('Azure region. Defaults to the resource group region.')
param location string = resourceGroup().location

@description('Container image tag pushed to ACR (set by deploy script).')
param imageTag string = 'latest'

@description('Container image repository name within ACR.')
param imageRepo string = 'workshop-buddy'

@description('Azure AI Foundry / AI Services account name that hosts the model deployment.')
param foundryAccountName string = 'jamesbas-demo-project-resource'

@description('Resource group that contains the Foundry / AI Services account.')
param foundryResourceGroupName string = resourceGroup().name

@description('AZURE_FOUNDRY_RESPONSES_ENDPOINT environment value.')
param foundryResponsesEndpoint string = 'https://jamesbas-demo-project-resource.services.ai.azure.com/api/projects/jamesbas-demo-project/openai/v1/responses'

@description('Model deployment name (Azure AI Foundry deployment id; case-sensitive).')
param foundryModel string = 'gpt-5.4'

@description('Min number of replicas.')
param minReplicas int = 1

@description('Max number of replicas.')
param maxReplicas int = 3

@description('Whether to deploy the container app. Set false on bootstrap before the image exists.')
param deployApp bool = true

// --- Azure Database for PostgreSQL Flexible Server (Entra-only auth) ---
@description('Postgres Flexible Server name. Must be globally unique.')
param pgServerName string = 'pg-workshopbuddy-wus3'

@description('Region for the Postgres Flexible Server.')
param pgServerLocation string = 'westus3'

@description('Postgres database name (created on the server).')
param pgDatabaseName string = 'workshopbuddy'

@description('Object ID (GUID) of the Microsoft Entra user/group set as Postgres admin.')
param pgEntraAdminObjectId string = 'df2eddbb-3b23-47ea-ab0a-21235fc0440d'

@description('Login name (UPN) of the Microsoft Entra Postgres admin.')
param pgEntraAdminLogin string = 'admin@MngEnvMCAP365575.onmicrosoft.com'

@description('Allow the developer workstation IP through the Postgres firewall. Empty string to skip.')
param pgDevWorkstationIp string = ''

// --- naming --------------------------------------------------------------
var suffix = uniqueString(resourceGroup().id, baseName)
var acrName = toLower(replace('${baseName}acr${suffix}', '-', ''))
var lawName = '${baseName}-law-${suffix}'
var envName = '${baseName}-env-${suffix}'
var appName = '${baseName}-app'
var uamiName = '${baseName}-uami'

// --- User-Assigned Managed Identity (used for ACR pulls + Foundry calls)
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: uamiName
  location: location
}

// --- Container Registry --------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

// AcrPull for the UAMI on the ACR. Created during bootstrap so it has time
// to propagate before the Container App tries to pull the image.
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, uami.id, acrPullRoleId)
  properties: {
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

// Cognitive Services User on the Foundry account (possibly in another RG).
module foundryRole './modules/foundry-role.bicep' = {
  name: 'foundryRoleAssignment'
  scope: resourceGroup(foundryResourceGroupName)
  params: {
    foundryAccountName: foundryAccountName
    principalId: uami.properties.principalId
  }
}

// --- Azure Database for PostgreSQL Flexible Server (Entra-only auth) ----
// The container's user-assigned managed identity is added as an Entra
// admin on the server (administrators sub-resource below), which gives
// it full schema privileges — sufficient for `prisma db push` + queries.
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
}

// Postgres Entra admins (the developer UPN and the UAMI) are configured by
// deploy.ps1 via `az postgres flexible-server ad-admin create` because the
// flexibleServers/administrators ARM PUT intermittently returns
// AadAuthOperationCannotBePerformedWhenServerIsNotAccessible during a deploy,
// and the CLI handles the retry/idempotency cleanly.

resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: pgServer
  name: pgDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allow Azure-internal services (Container Apps egress) to reach the server.
resource pgFwAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: pgServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Optional dev workstation firewall hole for local `prisma db push`.
resource pgFwDev 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (!empty(pgDevWorkstationIp)) {
  parent: pgServer
  name: 'AllowDevWorkstation'
  properties: {
    startIpAddress: pgDevWorkstationIp
    endIpAddress: pgDevWorkstationIp
  }
}

// --- Log Analytics + ACA Environment ------------------------------------
resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: lawName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
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
}

// --- Container App -------------------------------------------------------
resource app 'Microsoft.App/containerApps@2024-03-01' = if (deployApp) {
  name: appName
  location: location
  dependsOn: [
    acrPull
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
        targetPort: 3000
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
          image: '${acr.properties.loginServer}/${imageRepo}:${imageTag}'
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'HOSTNAME', value: '0.0.0.0' }
            // Azure Database for PostgreSQL Flexible Server with Entra auth.
            // The container's start.js fetches an Entra access token via
            // @azure/identity and uses it as the Postgres password.
            { name: 'DATABASE_URL', value: 'postgresql://${uamiName}@${pgServer.properties.fullyQualifiedDomainName}:5432/${pgDatabaseName}?sslmode=require' }
            { name: 'APP_NAME', value: 'Workshop Buddy' }
            { name: 'AI_PROVIDER', value: 'azure_foundry' }
            { name: 'AZURE_FOUNDRY_RESPONSES_ENDPOINT', value: foundryResponsesEndpoint }
            { name: 'AZURE_FOUNDRY_MODEL', value: foundryModel }
            // Tell DefaultAzureCredential which UAMI to use
            { name: 'AZURE_CLIENT_ID', value: uami.properties.clientId }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/health', port: 3000 }
              initialDelaySeconds: 20
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/api/health', port: 3000 }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
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
output containerAppFqdn string = deployApp ? app.properties.configuration.ingress.fqdn : ''
output containerAppUrl string = deployApp ? 'https://${app.properties.configuration.ingress.fqdn}' : ''
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output appName string = deployApp ? app.name : ''
output uamiName string = uami.name
output uamiPrincipalId string = uami.properties.principalId
output uamiClientId string = uami.properties.clientId
output sqlServerFqdn string = ''
output sqlServerName string = ''
output sqlDatabaseName string = ''
output pgServerFqdn string = pgServer.properties.fullyQualifiedDomainName
output pgServerName string = pgServer.name
output pgDatabaseName string = pgDb.name
output pgEntraAdminLogin string = pgEntraAdminLogin
