#!/bin/bash
# Script para crear usuario IAM y política para despliegue de CDK
# Uso: ./scripts/create-iam-user.sh <USERNAME>

set -e

USERNAME=${1:-"sotrux-auto-cdk-deployer"}

if [ -z "$USERNAME" ]; then
  echo "Error: Nombre de usuario requerido"
  echo "Uso: $0 <USERNAME>"
  echo "Ejemplo: $0 sotrux-auto-cdk-deployer"
  exit 1
fi

echo "Creando usuario IAM: $USERNAME"
echo ""

# Verificar si el usuario ya existe
if aws iam get-user --user-name "$USERNAME" &>/dev/null; then
  echo "⚠️  El usuario $USERNAME ya existe"
  read -p "¿Continuar de todas formas? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  # Crear el usuario
  echo "Creando usuario IAM..."
  aws iam create-user --user-name "$USERNAME" --tags \
    Key=Name,Value=$USERNAME \
    Key=App,Value=sotrux-auto \
    Key=Owner,Value=devops@sotrux \
    Key=Purpose,Value=CDK-Deployment
  
  if [ $? -eq 0 ]; then
    echo "✅ Usuario creado exitosamente"
  else
    echo "❌ Error al crear usuario"
    exit 1
  fi
fi

# Crear la política
POLICY_NAME="${USERNAME}-policy"
POLICY_FILE="scripts/iam-policy-deployment.json"

echo ""
echo "Creando política IAM: $POLICY_NAME"

# Verificar si la política ya existe
EXISTING_POLICY=$(aws iam list-policies --scope Local --query \
  "Policies[?PolicyName=='${POLICY_NAME}'].Arn" --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_POLICY" ] && [ "$EXISTING_POLICY" != "None" ]; then
  echo "⚠️  La política $POLICY_NAME ya existe: $EXISTING_POLICY"
  POLICY_ARN=$EXISTING_POLICY
else
  # Crear la política desde el archivo JSON
  echo "Creando política desde $POLICY_FILE..."
  POLICY_ARN=$(aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document "file://${POLICY_FILE}" \
    --description "Policy para despliegue de CDK - Sotrux Auto" \
    --tags Key=Name,Value=$POLICY_NAME \
           Key=App,Value=sotrux-auto \
           Key=Owner,Value=devops@sotrux \
    --query 'Policy.Arn' --output text)
  
  if [ $? -eq 0 ]; then
    echo "✅ Política creada exitosamente: $POLICY_ARN"
  else
    echo "❌ Error al crear política"
    exit 1
  fi
fi

# Adjuntar la política al usuario
echo ""
echo "Adjuntando política al usuario..."

# Verificar si ya está adjunta
ATTACHED_POLICIES=$(aws iam list-attached-user-policies --user-name "$USERNAME" \
  --query "AttachedPolicies[?PolicyArn=='${POLICY_ARN}'].PolicyArn" --output text 2>/dev/null || echo "")

if [ -n "$ATTACHED_POLICIES" ] && [ "$ATTACHED_POLICIES" != "None" ]; then
  echo "⚠️  La política ya está adjunta al usuario"
else
  aws iam attach-user-policy \
    --user-name "$USERNAME" \
    --policy-arn "$POLICY_ARN"
  
  if [ $? -eq 0 ]; then
    echo "✅ Política adjuntada exitosamente"
  else
    echo "❌ Error al adjuntar política"
    exit 1
  fi
fi

# Crear access keys
echo ""
echo "Creando Access Keys para el usuario..."
read -p "¿Crear Access Keys ahora? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  # Verificar si ya existen keys
  EXISTING_KEYS=$(aws iam list-access-keys --user-name "$USERNAME" --query 'AccessKeyMetadata' --output json)
  KEY_COUNT=$(echo "$EXISTING_KEYS" | grep -c "AccessKeyId" || echo "0")
  
  if [ "$KEY_COUNT" -ge 2 ]; then
    echo "⚠️  El usuario ya tiene 2 Access Keys (máximo permitido)"
    echo "Elimina una antes de crear una nueva"
  else
    CREDENTIALS=$(aws iam create-access-key --user-name "$USERNAME")
    
    ACCESS_KEY=$(echo "$CREDENTIALS" | grep -o '"AccessKeyId": "[^"]*"' | cut -d'"' -f4)
    SECRET_KEY=$(echo "$CREDENTIALS" | grep -o '"SecretAccessKey": "[^"]*"' | cut -d'"' -f4)
    
    echo ""
    echo "✅ Access Keys creadas:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "AWS_ACCESS_KEY_ID=$ACCESS_KEY"
    echo "AWS_SECRET_ACCESS_KEY=$SECRET_KEY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⚠️  IMPORTANTE: Guarda estas credenciales de forma segura."
    echo "   No las compartas ni las subas a GitHub."
    echo ""
    echo "Para configurar AWS CLI:"
    echo "  aws configure --profile sotrux-dev"
    echo "  # Ingresa el Access Key ID y Secret Access Key cuando te lo pida"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configuración completada"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Usuario: $USERNAME"
echo "Política: $POLICY_ARN"
echo ""
echo "Próximos pasos:"
echo "1. Configurar AWS CLI con las credenciales:"
echo "   aws configure --profile sotrux-dev"
echo ""
echo "2. Verificar credenciales:"
echo "   aws sts get-caller-identity --profile sotrux-dev"
echo ""
echo "3. Continuar con el despliegue siguiendo el documents/DEPLOYMENT_CHECKLIST.md"

