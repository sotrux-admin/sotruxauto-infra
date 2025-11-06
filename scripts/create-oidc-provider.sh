#!/bin/bash
# Script para crear el OIDC Provider de GitHub en AWS
# Uso: ./scripts/create-oidc-provider.sh <ACCOUNT_ID> <REGION>

set -e

ACCOUNT_ID=${1:-""}
REGION=${2:-"us-east-2"}

if [ -z "$ACCOUNT_ID" ]; then
  echo "Error: Account ID requerido"
  echo "Uso: $0 <ACCOUNT_ID> [REGION]"
  echo "Ejemplo: $0 123456789012 us-east-2"
  exit 1
fi

echo "Creando OIDC Provider para GitHub Actions..."
echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"
echo ""

# Verificar si el provider ya existe
EXISTING_PROVIDER=$(aws iam list-open-id-connect-providers --query \
  "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn" \
  --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_PROVIDER" ]; then
  echo "⚠️  OIDC Provider ya existe: $EXISTING_PROVIDER"
  echo "No se creará uno nuevo."
  exit 0
fi

# Thumbprint de GitHub (actualizado periódicamente)
# Ver: https://github.com/actions/runner-images/blob/main/images/linux/Ubuntu2004-Readme.md
GITHUB_THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"

# Crear el OIDC provider
echo "Creando OIDC Provider..."
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list $GITHUB_THUMBPRINT \
  --tags Key=Name,Value=github-actions-oidc-provider \
         Key=App,Value=sotrux-auto \
         Key=Owner,Value=devops@sotrux \
  --region $REGION

if [ $? -eq 0 ]; then
  echo "✅ OIDC Provider creado exitosamente"
  echo "ARN: arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
else
  echo "❌ Error al crear OIDC Provider"
  exit 1
fi

echo ""
echo "Verificar con:"
echo "aws iam list-open-id-connect-providers"

