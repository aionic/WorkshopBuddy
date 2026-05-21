// Parameters for deploying Workshop Buddy to the rgWorkshopBuddy
// resource group. Edit values here or override on the command line.

using './main.bicep'

param baseName = 'workshopbuddy'
param imageRepo = 'workshop-buddy'
param imageTag = 'latest'
param foundryAccountName = 'jamesbas-demo-project-resource'
param foundryResourceGroupName = 'rg-jamesbas-demo-project'
param foundryResponsesEndpoint = 'https://jamesbas-demo-project-resource.services.ai.azure.com/api/projects/jamesbas-demo-project/openai/v1/responses'
param foundryModel = 'gpt-5.4'
param minReplicas = 1
param maxReplicas = 3

// Azure Database for PostgreSQL Flexible Server (Entra-only auth)
param pgServerName = 'pg-workshopbuddy-wus3'
param pgServerLocation = 'westus3'
param pgDatabaseName = 'workshopbuddy'
param pgEntraAdminObjectId = 'df2eddbb-3b23-47ea-ab0a-21235fc0440d'
param pgEntraAdminLogin = 'admin@MngEnvMCAP365575.onmicrosoft.com'
