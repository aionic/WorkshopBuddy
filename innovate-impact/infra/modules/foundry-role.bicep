// Cross-RG module: grants 'Cognitive Services User' on the Azure AI Foundry
// account so the Container App's managed identity can call models via Entra.
targetScope = 'resourceGroup'

@description('Foundry / AI Services account name.')
param foundryAccountName string

@description('Object id (principalId) of the Container App managed identity.')
param principalId string

resource foundry 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: foundryAccountName
}

// Cognitive Services User
var roleDefId = 'a97b65f3-24c7-4388-baec-2e87135dc908'

resource ra 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: foundry
  name: guid(foundry.id, principalId, roleDefId)
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefId)
  }
}
