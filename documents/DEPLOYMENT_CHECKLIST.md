# Checklist de Despliegue - IAC-000

Checklist paso a paso para el primer despliegue en ambiente dev usando GitHub Actions.

## 📋 Pre-requisitos

### AWS
- [ ] Tener acceso a cuenta AWS dev
- [ ] Tener permisos de administrador (para crear OIDC provider y bootstrap)
- [ ] Identificar Account ID de dev: `________________`
- [ ] Región configurada: `us-east-2`

### GitHub
- [ ] Repositorio creado: `sotrux-admin/sotruxauto-infra`
- [ ] Acceso de administrador al repositorio
- [ ] Branch `feature/IAC-000` o `main` creada

---

## 🔧 Fase 1: Configuración AWS (Manual)

### 1.1 Crear OIDC Provider

**Opción A: Usar script**
```bash
./scripts/create-oidc-provider.sh <ACCOUNT_ID> us-east-2
```

**Opción B: Manual**
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --tags Key=Name,Value=github-actions-oidc-provider \
         Key=App,Value=sotrux-auto
```

**Verificar:**
```bash
aws iam list-open-id-connect-providers
```

- [ ] OIDC Provider creado
- [ ] ARN verificado: `arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com`

---

### 1.2 Bootstrap CDK (Primera vez)

**Opción A: Usar script**
```bash
./scripts/bootstrap-cdk.sh <ACCOUNT_ID> us-east-2 [AWS_PROFILE]
```

**Opción B: Manual**
```bash
export AWS_PROFILE=dev-profile
export CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID>
export CDK_DEFAULT_REGION=us-east-2
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-2
```

**Verificar:**
```bash
aws cloudformation describe-stacks --stack-name CDKToolkit --region us-east-2
```

- [ ] Bootstrap completado
- [ ] Stack CDKToolkit existe en CloudFormation

---

## 🔧 Fase 2: Configuración GitHub

### 2.1 Configurar Secrets

Ir a: **Settings → Secrets and variables → Actions → New repository secret**

**Secrets requeridos:**

| Secret Name | Valor | Estado |
|------------|-------|--------|
| `AWS_ACCOUNT_ID_DEV` | `<ACCOUNT_ID>` | [ ] |
| `AWS_BOOTSTRAP_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_NAME>` (opcional, para bootstrap) | [ ] |

**Nota:** `AWS_BOOTSTRAP_ROLE_ARN` es opcional. Si no se configura, el bootstrap debe hacerse manualmente desde local.

- [ ] Secrets configurados en GitHub

---

### 2.2 Configurar Variables (Opcional)

Ir a: **Settings → Secrets and variables → Actions → Variables → New repository variable**

- [ ] Variables configuradas (opcional)

---

## 🚀 Fase 3: Primer Despliegue

### 3.1 Despliegue Manual (Primera vez)

**IMPORTANTE:** El primer despliegue debe hacerse manualmente porque el GitHub OIDC role aún no existe.

**Opción A: Desde local**

```bash
# Configurar credenciales
export AWS_PROFILE=dev-profile
export CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID>
export CDK_DEFAULT_REGION=us-east-2

# Desplegar VPC Stack primero
npx cdk deploy --context env=dev SotruxAutoVpc-dev

# Desplegar IAM Stack (esto creará el GitHub OIDC role)
npx cdk deploy --context env=dev \
  --context github-repository=sotrux-admin/sotruxauto-infra \
  --context github-branch=feature/IAC-000 \
  SotruxAutoIam-dev
```

**Opción B: Usar GitHub Actions (después de configurar)**

1. Hacer push del workflow a GitHub
2. Ir a **Actions → Deploy Infrastructure - Dev**
3. Click en **Run workflow**
4. Seleccionar `action: deploy`

- [ ] VPC Stack desplegado
- [ ] IAM Stack desplegado
- [ ] GitHub OIDC role creado: `sotrux-auto-cdk-deploy-role-dev`

---

### 3.2 Verificar Despliegue

```bash
# Verificar stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query "StackSummaries[?contains(StackName, 'SotruxAuto')]" \
  --region us-east-2

# Verificar VPC
aws ec2 describe-vpcs \
  --filters "Name=tag:App,Values=sotrux-auto" "Name=tag:Env,Values=dev" \
  --region us-east-2

# Verificar roles IAM
aws iam list-roles \
  --query "Roles[?contains(RoleName, 'sotrux-auto')].RoleName" \
  --region us-east-2
```

- [ ] Stacks verificados en CloudFormation
- [ ] VPC creada con tags correctos
- [ ] Roles IAM creados

---

## 🔄 Fase 4: Configurar Workflow Automático

### 4.1 Hacer Push del Workflow

```bash
git add .github/workflows/deploy-dev.yml
git commit -m "ci: Agregar workflow de despliegue para dev"
git push origin feature/IAC-000
```

- [ ] Workflow subido a GitHub
- [ ] Workflow visible en **Actions** tab

### 4.2 Verificar Workflow

1. Ir a **Actions** en GitHub
2. Verificar que el workflow aparece
3. Hacer un cambio pequeño y push para trigger de validación

- [ ] Workflow ejecuta job de validación
- [ ] Validación pasa sin errores

---

### 4.3 Probar Despliegue Automático

**Primera vez (después de crear GitHub OIDC role):**

1. Hacer push a `main` o usar **Run workflow** manualmente
2. Verificar que el job de deploy se ejecuta
3. Verificar que los stacks se despliegan correctamente

- [ ] Deploy automático funciona
- [ ] Stacks actualizados correctamente

---

## ✅ Verificación Final

### Validaciones

- [ ] `cdk synth` genera templates sin errores
- [ ] `cdk-nag` no reporta findings High
- [ ] `cdk diff` muestra "No changes" después del deploy
- [ ] Todos los recursos tienen tags estándar
- [ ] VPC Endpoints funcionan correctamente
- [ ] Roles IAM tienen permisos mínimos

### Recursos Creados

- [ ] VPC: `sotrux-auto-vpc-dev`
- [ ] 2 subredes públicas
- [ ] 2 subredes privadas
- [ ] 1 NAT Gateway
- [ ] 5 VPC Endpoints (SSM, Secrets, Logs, ECR API, ECR Docker)
- [ ] 1 S3 Gateway Endpoint
- [ ] GitHub OIDC Role: `sotrux-auto-cdk-deploy-role-dev`
- [ ] ECS Task Execution Role: `sotrux-auto-ecs-task-execution-role-dev`
- [ ] ECS Task Role: `sotrux-auto-ecs-task-role-dev`

---

## 📝 Notas

- El primer despliegue debe hacerse manualmente para crear el GitHub OIDC role
- Después del primer despliegue, los despliegues subsecuentes pueden ser automáticos
- El workflow valida en cada PR y despliega automáticamente en push a `main`
- Para despliegues manuales, usar **Run workflow** en GitHub Actions

---

## 🆘 Troubleshooting

### Error: "OIDC provider not found"
- Verificar que el provider existe: `aws iam list-open-id-connect-providers`
- Verificar que el ARN es correcto en el código

### Error: "Role cannot be assumed"
- Verificar que el IAM Stack fue desplegado primero
- Verificar el trust policy del role
- Verificar que el repositorio/branch coinciden

### Error: "Bootstrap not found"
- Ejecutar bootstrap manualmente
- Verificar que el stack CDKToolkit existe

### Error: "No credentials"
- Verificar secrets en GitHub
- Verificar que el workflow tiene permisos `id-token: write`

