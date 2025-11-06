#!/bin/bash
# Script para hacer bootstrap de CDK en una cuenta/región
# Uso: ./scripts/bootstrap-cdk.sh <ACCOUNT_ID> <REGION> [PROFILE]

set -e

ACCOUNT_ID=${1:-""}
REGION=${2:-"us-east-2"}
PROFILE=${3:-""}

if [ -z "$ACCOUNT_ID" ]; then
  echo "Error: Account ID requerido"
  echo "Uso: $0 <ACCOUNT_ID> <REGION> [AWS_PROFILE]"
  echo "Ejemplo: $0 123456789012 us-east-2 dev-profile"
  exit 1
fi

if [ -n "$PROFILE" ]; then
  export AWS_PROFILE=$PROFILE
  echo "Usando AWS Profile: $PROFILE"
fi

echo "Bootstrap CDK en cuenta AWS..."
echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"
echo ""

# Verificar credenciales
echo "Verificando credenciales AWS..."
CALLER_IDENTITY=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$CALLER_IDENTITY" ]; then
  echo "❌ Error: No se pudieron obtener credenciales AWS"
  exit 1
fi

if [ "$CALLER_IDENTITY" != "$ACCOUNT_ID" ]; then
  echo "⚠️  Advertencia: Account ID en credenciales ($CALLER_IDENTITY) no coincide con el especificado ($ACCOUNT_ID)"
  read -p "¿Continuar de todas formas? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Verificar si ya está bootstraped
echo "Verificando si CDK ya está bootstraped..."
BOOTSTRAP_STACK=$(aws cloudformation describe-stacks \
  --stack-name CDKToolkit \
  --region $REGION \
  --query 'Stacks[0].StackName' \
  --output text 2>/dev/null || echo "")

if [ -n "$BOOTSTRAP_STACK" ] && [ "$BOOTSTRAP_STACK" != "None" ]; then
  echo "⚠️  CDK ya está bootstraped en esta cuenta/región"
  read -p "¿Re-ejecutar bootstrap de todas formas? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
  fi
fi

# Ejecutar bootstrap
echo "Ejecutando CDK bootstrap..."
export CDK_DEFAULT_ACCOUNT=$ACCOUNT_ID
export CDK_DEFAULT_REGION=$REGION

npx cdk bootstrap aws://$ACCOUNT_ID/$REGION

if [ $? -eq 0 ]; then
  echo "✅ CDK bootstrap completado exitosamente"
else
  echo "❌ Error al ejecutar CDK bootstrap"
  exit 1
fi

echo ""
echo "Verificar con:"
echo "aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION"

