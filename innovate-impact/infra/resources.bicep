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

@description('Entra app (client) id for ACA Easy Auth. Empty disables Easy Auth.')
param aadAppClientId string = ''

@secure()
@description('Entra app client secret for ACA Easy Auth. Required when aadAppClientId is set.')
param aadAppClientSecret string = ''

var easyAuthEnabled = !empty(aadAppClientId) && !empty(aadAppClientSecret)

// --- naming (all derived, globally unique where required) ---------------
var acrName = toLower(replace('wb${resourceToken}acr', '-', ''))
var lawName = 'wb-${resourceToken}-law'
var envName = 'wb-${resourceToken}-env'
var appName = 'wb-${resourceToken}-app'
var uamiName = 'wb-${resourceToken}-uami'
var sbNamespaceName = 'wb-${resourceToken}-bus'
var agentRunsQueueName = 'agent-runs'
var workerJobName = 'wb-${resourceToken}-worker'
var sweeperJobName = 'wb-${resourceToken}-sweeper'
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
      secrets: easyAuthEnabled ? [
        {
          name: 'aad-client-secret'
          value: aadAppClientSecret
        }
      ] : []
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
            { name: 'SERVICEBUS_NAMESPACE', value: '${sbNamespace.name}.servicebus.windows.net' }
            { name: 'SERVICEBUS_QUEUE', value: agentRunsQueueName }
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

// --- ACA Easy Auth (Entra ID, single-tenant) ---------------------------
// Only configured when the preprovision hook produced an app registration.
resource appAuth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = if (easyAuthEnabled) {
  parent: app
  name: 'current'
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
      // Health probe must remain anonymous; Next.js prefetch/static assets
      // are served from /_next/* and never need an auth challenge.
      excludedPaths: [
        '/api/health'
        '/_next/static/*'
        '/_next/image*'
        '/favicon.ico'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: aadAppClientId
          clientSecretSettingName: 'aad-client-secret'
          openIdIssuer: '${environment().authentication.loginEndpoint}${subscription().tenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            'api://${aadAppClientId}'
          ]
        }
      }
    }
    login: {
      tokenStore: {
        enabled: false
      }
      preserveUrlFragmentsForLogins: false
      routes: {}
    }
  }
}

// --- Service Bus (agent run queue) -------------------------------------
// Basic SKU is sufficient: single queue, no topics, no sessions, no DLQ
// forwarding. Auto-DLQ on max delivery still works.
resource sbNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: sbNamespaceName
  location: location
  sku: { name: 'Basic', tier: 'Basic' }
  properties: {
    disableLocalAuth: true
    minimumTlsVersion: '1.2'
  }
  tags: tags
}

resource sbQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: sbNamespace
  name: agentRunsQueueName
  properties: {
    maxDeliveryCount: 2          // 1 retry then dead-letter
    lockDuration: 'PT5M'         // worker renews this every 30s
    defaultMessageTimeToLive: 'PT1H'
    deadLetteringOnMessageExpiration: true
  }
}

// One role grants both send and receive — same UAMI is shared by web
// (producer) and worker job (consumer).
var sbDataOwnerRoleId = '090c5cfd-751d-490a-894a-3ce6f1109419'
resource sbDataOwnerForUami 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: sbNamespace
  name: guid(sbNamespace.id, uami.id, sbDataOwnerRoleId)
  properties: {
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', sbDataOwnerRoleId)
  }
}

// --- Container Apps Jobs (worker + sweeper) ----------------------------
var jobEnvVars = [
  { name: 'NODE_ENV', value: 'production' }
  { name: 'DATABASE_URL', value: 'postgresql://${pgAdminLogin}@${pgServer.properties.fullyQualifiedDomainName}:5432/${pgDatabaseName}?sslmode=require' }
  { name: 'AI_PROVIDER', value: 'azure_foundry' }
  { name: 'AZURE_FOUNDRY_RESPONSES_ENDPOINT', value: '${foundry.properties.endpoint}openai/v1/responses' }
  { name: 'AZURE_FOUNDRY_MODEL', value: foundryModelName }
  { name: 'AZURE_CLIENT_ID', value: uami.properties.clientId }
  { name: 'SERVICEBUS_NAMESPACE', value: '${sbNamespace.name}.servicebus.windows.net' }
  { name: 'SERVICEBUS_QUEUE', value: agentRunsQueueName }
]

// Event-triggered consumer: KEDA azure-servicebus scaler watches queue depth
// and starts one replica per message (up to maxExecutions).
resource workerJob 'Microsoft.App/jobs@2024-03-01' = {
  name: workerJobName
  location: location
  tags: tags
  dependsOn: [
    acrPullForUami
    sbDataOwnerForUami
  ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uami.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      triggerType: 'Event'
      replicaTimeout: 1800       // 30 min
      replicaRetryLimit: 0       // Service Bus handles retry semantics
      registries: [
        { server: acr.properties.loginServer, identity: uami.id }
      ]
      eventTriggerConfig: {
        replicaCompletionCount: 1
        parallelism: 1
        scale: {
          minExecutions: 0
          maxExecutions: 5
          pollingInterval: 30
          rules: [
            {
              name: 'agent-runs-queue'
              type: 'azure-servicebus'
              metadata: {
                namespace: sbNamespace.name
                queueName: agentRunsQueueName
                messageCount: '1'
              }
              identity: uami.id
            }
          ]
        }
      }
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: webAppImage
          command: [ 'node_modules/.bin/tsx', 'worker/agent-run-worker.ts' ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: jobEnvVars
        }
      ]
    }
  }
}

// Schedule-triggered sweeper: every 5 minutes, mark Running runs older
// than 30 min as Failed (safety net for crashed/killed worker replicas).
resource sweeperJob 'Microsoft.App/jobs@2024-03-01' = {
  name: sweeperJobName
  location: location
  tags: tags
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
    environmentId: env.id
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 300
      replicaRetryLimit: 1
      registries: [
        { server: acr.properties.loginServer, identity: uami.id }
      ]
      scheduleTriggerConfig: {
        cronExpression: '*/5 * * * *'
        parallelism: 1
        replicaCompletionCount: 1
      }
    }
    template: {
      containers: [
        {
          name: 'sweeper'
          image: webAppImage
          command: [ 'node', 'worker/sweeper.js' ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: jobEnvVars
        }
      ]
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
output easyAuthEnabled bool = easyAuthEnabled
output serviceBusNamespace string = '${sbNamespace.name}.servicebus.windows.net'
output agentRunsQueueName string = agentRunsQueueName
output workerJobName string = workerJob.name
output sweeperJobName string = sweeperJob.name
