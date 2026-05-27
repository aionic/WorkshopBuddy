// =====================================================================
// Workshop Buddy — end-to-end azd deployment (subscription scope).
//
// `azd up` creates a fresh resource group named `rg-${environmentName}`
// and provisions every dependency: ACR, Log Analytics, Container Apps
// environment, User-Assigned Managed Identity, Postgres flexible server
// (Entra-only auth), Azure AI Foundry account + model deployment, and
// every required role assignment.
//
// No hard-coded names. Every resource derives its name from
// `environmentName` plus a per-subscription `resourceToken`, which keeps
// global names (ACR, Postgres FQDN, Foundry) unique across redeploys
// and across users sharing a subscription.
// =====================================================================

targetScope = 'subscription'

@minLength(1)
@maxLength(20)
@description('azd environment name. Drives all derived resource names. Provided automatically by `azd up`.')
param environmentName string

@minLength(1)
@description('Primary location for the resource group and most resources.')
param location string

@description('Object id of the principal running `azd up` — granted Postgres Entra admin so they can run `prisma db push` locally. Defaults to AZURE_PRINCIPAL_ID from azd.')
param principalId string = ''

@description('Region for Postgres flexible server (override when the primary region lacks Burstable SKUs). Empty = use `location`.')
param pgServerLocation string = ''

@description('Region for the Azure AI Foundry account (must be a region where the chosen model is offered). Empty = use `location`.')
param foundryLocation string = ''

@description('Model deployment name (also used as deployment id and OpenAI model id).')
param foundryModelName string = 'gpt-4o-mini'

@description('Model version pinned for the deployment.')
param foundryModelVersion string = '2024-07-18'

@description('Foundry model deployment SKU (e.g. GlobalStandard, Standard).')
param foundryModelSku string = 'GlobalStandard'

@description('Foundry model deployment capacity (TPM units / 1000).')
param foundryModelCapacity int = 10

@description('Initial container image. Defaults to the Azure-supplied quickstart so the Container App can be provisioned before the real image exists; `azd deploy` will swap to the freshly-built image.')
param webAppImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Container port the workload listens on. Quickstart listens on 80; the real Workshop Buddy image is configured (via PORT env) to also listen on 80.')
param appTargetPort int = 80

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var rgName = 'rg-${environmentName}'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: rgName
  location: location
  tags: {
    'azd-env-name': environmentName
  }
}

module resources 'resources.bicep' = {
  scope: rg
  name: 'workshopbuddy-resources'
  params: {
    location: location
    environmentName: environmentName
    resourceToken: resourceToken
    principalId: principalId
    pgServerLocation: empty(pgServerLocation) ? location : pgServerLocation
    foundryLocation: empty(foundryLocation) ? location : foundryLocation
    foundryModelName: foundryModelName
    foundryModelVersion: foundryModelVersion
    foundryModelSku: foundryModelSku
    foundryModelCapacity: foundryModelCapacity
    webAppImage: webAppImage
    appTargetPort: appTargetPort
  }
}

output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.acrLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = resources.outputs.acrName
output AZURE_CONTAINER_APP_NAME string = resources.outputs.appName
output AZURE_CONTAINER_APP_FQDN string = resources.outputs.appFqdn
output SERVICE_WEB_NAME string = resources.outputs.appName
output SERVICE_WEB_URI string = resources.outputs.appUri
output AZURE_PG_SERVER_NAME string = resources.outputs.pgServerName
output AZURE_PG_SERVER_FQDN string = resources.outputs.pgServerFqdn
output AZURE_PG_DATABASE_NAME string = resources.outputs.pgDatabaseName
output AZURE_FOUNDRY_ACCOUNT string = resources.outputs.foundryAccount
output AZURE_FOUNDRY_ENDPOINT string = resources.outputs.foundryEndpoint
output AZURE_FOUNDRY_RESPONSES_ENDPOINT string = resources.outputs.foundryResponsesEndpoint
output AZURE_FOUNDRY_MODEL string = foundryModelName
output AZURE_UAMI_CLIENT_ID string = resources.outputs.uamiClientId
output AZURE_UAMI_PRINCIPAL_ID string = resources.outputs.uamiPrincipalId
