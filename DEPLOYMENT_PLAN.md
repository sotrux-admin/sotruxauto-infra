# Plan de Despliegue con GitHub Actions - IAC-000

Este documento describe el plan paso a paso para configurar el despliegue automático de la infraestructura usando GitHub Actions.

## 📋 Fase 1: Configuración Inicial (Manual)

### 1.1 Crear OIDC Provider en AWS (Una vez por cuenta)

El OIDC Provider permite a GitHub Actions autenticarse con AWS sin usar secretos.

**Opción A: Manual (AWS Console/CLI)**
```bash
# Obtener el thumbprint de GitHub
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

**Opción B: Usar CloudFormation/Terraform**
- Crear stack separado para el OIDC provider
- O usar el script proporcionado en `scripts/create-oidc-provider.sh`

**Verificar que existe:**
```bash
aws iam list-open-id-connect-providers
# Debe mostrar: arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com
```

### 1.2 Configurar Secrets en GitHub

En el repositorio GitHub (`sotrux-admin/sotruxauto-infra`), ir a:
**Settings → Secrets and variables → Actions → New repository secret**

Configurar los siguientes secrets:

| Secret Name | Descripción | Ejemplo |
|------------|-------------|---------|
| `AWS_ACCOUNT_ID_DEV` | Account ID de AWS para dev | `123456789012` |
| `AWS_REGION` | Región de AWS | `us-east-2` |

**Nota:** No necesitamos `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY` porque usamos OIDC.

### 1.3 Configurar Variables en GitHub (Opcional)

**Settings → Secrets and variables → Actions → Variables → New repository variable**

| Variable Name | Valor | Descripción |
|--------------|-------|-------------|
| `GITHUB_REPOSITORY` | `sotrux-admin/sotruxauto-infra` | Repositorio completo |
| `GITHUB_BRANCH_DEV` | `feature/IAC-000` o `dev` | Branch por defecto para dev |

---

## 📋 Fase 2: Bootstrap CDK (Una vez por cuenta/región)

### 2.1 Bootstrap Manual (Primera vez)

**Opción A: Desde local con credenciales temporales**
```bash
# Configurar credenciales AWS
export AWS_PROFILE=dev-profile
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-2

# Bootstrap
cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/us-east-2
```

**Opción B: Usar GitHub Actions (después de configurar OIDC)**
- El workflow tiene un job de bootstrap que se ejecuta manualmente la primera vez

---

## 📋 Fase 3: Primer Despliegue

### 3.1 Despliegue Manual (Primera vez)

**Opción A: Desde local**
```bash
# Configurar variables
export AWS_PROFILE=dev-profile
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-2

# Desplegar VPC Stack primero
cdk deploy --context env=dev SotruxAutoVpc-dev

# Desplegar IAM Stack (esto creará el GitHub OIDC role)
cdk deploy --context env=dev \
  --context github-repository=sotrux-admin/sotruxauto-infra \
  --context github-branch=feature/IAC-000 \
  SotruxAutoIam-dev
```

**Opción B: Usar GitHub Actions**
- Después de configurar el workflow, hacer push o crear un PR
- El workflow se ejecutará automáticamente según los triggers configurados

### 3.2 Verificar Despliegue

```bash
# Verificar stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Verificar VPC
aws ec2 describe-vpcs --filters "Name=tag:App,Values=sotrux-auto" "Name=tag:Env,Values=dev"

# Verificar roles IAM
aws iam list-roles | grep sotrux-auto
```

---

## 📋 Fase 4: Configurar GitHub Actions Workflow

### 4.1 Crear el Workflow

El workflow se creará en `.github/workflows/deploy-dev.yml` y tendrá:

1. **Job de validación:**
   - Instalar dependencias
   - Compilar TypeScript
   - Ejecutar cdk-nag
   - Sintetizar templates

2. **Job de bootstrap (manual):**
   - Bootstrap CDK en la cuenta/región
   - Solo se ejecuta manualmente la primera vez

3. **Job de despliegue:**
   - Validar cambios
   - Desplegar VPC Stack
   - Desplegar IAM Stack
   - Ejecutar cdk diff para verificar

### 4.2 Triggers del Workflow

- **Push a `feature/IAC-000`**: Solo validación
- **Pull Request a `main`**: Validación + preview
- **Push a `main`**: Despliegue completo
- **Workflow dispatch manual**: Despliegue manual

---

## 📋 Fase 5: Permisos y Seguridad

### 5.1 Permisos del GitHub OIDC Role

El role `sotrux-auto-cdk-deploy-role-dev` tendrá:
- Permisos para CloudFormation
- Permisos para S3 (bootstrap bucket)
- Permisos para IAM (crear roles para recursos)
- Permisos para EC2, VPC, ECS, etc. (crear recursos)

### 5.2 Restricciones del Trust Policy

El role solo puede ser asumido por:
- Repositorio: `sotrux-admin/sotruxauto-infra`
- Branch: `feature/IAC-000` (o el branch configurado)
- Audiencia: `sts.amazonaws.com`

### 5.3 Protección de Branch (Opcional)

Configurar en GitHub:
- Requerir PR para merge a `main`
- Requerir aprobaciones antes de deploy
- Requerir que los checks pasen

---

## 🚀 Secuencia de Ejecución

### Primera Vez (Setup)

```
1. Crear OIDC Provider en AWS (manual)
   ↓
2. Configurar Secrets en GitHub (manual)
   ↓
3. Bootstrap CDK (manual o workflow)
   ↓
4. Desplegar IAM Stack (crea GitHub OIDC role)
   ↓
5. Desplegar VPC Stack
   ↓
6. Configurar workflow para despliegues automáticos
```

### Despliegues Subsecuentes

```
1. Push a branch / Crear PR
   ↓
2. GitHub Actions ejecuta validación
   ↓
3. Si pasa, ejecuta despliegue (si es main)
   ↓
4. Verifica con cdk diff
```

---

## 📝 Checklist de Preparación

### Pre-requisitos
- [ ] Repositorio GitHub creado: `sotrux-admin/sotruxauto-infra`
- [ ] Acceso a cuenta AWS dev
- [ ] Permisos de administrador en AWS (para crear OIDC provider y bootstrap)

### Configuración AWS
- [ ] OIDC Provider creado en AWS dev
- [ ] Bootstrap CDK ejecutado en cuenta/región dev
- [ ] Account ID de dev identificado

### Configuración GitHub
- [ ] Secrets configurados en GitHub
- [ ] Variables configuradas (opcional)
- [ ] Workflow creado en `.github/workflows/`

### Primer Despliegue
- [ ] IAM Stack desplegado (crea GitHub OIDC role)
- [ ] VPC Stack desplegado
- [ ] Verificación de recursos creados
- [ ] cdk diff muestra "No changes"

---

## 🔧 Troubleshooting

### Error: "OIDC provider not found"
- Verificar que el provider existe: `aws iam list-open-id-connect-providers`
- Verificar el ARN en el código: debe ser `arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com`

### Error: "Role cannot be assumed"
- Verificar que el trust policy del role permite el repositorio/branch correcto
- Verificar que el workflow está usando el OIDC correctamente

### Error: "CDK bootstrap not found"
- Ejecutar bootstrap manualmente: `cdk bootstrap aws://ACCOUNT_ID/REGION`
- O usar el job de bootstrap del workflow

### Error: "Stack already exists"
- Si es el primer deploy, verificar que no haya stacks huérfanos
- Si es update, verificar que el stack existe y está en estado válido

---

## 📚 Referencias

- [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS CDK Bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

