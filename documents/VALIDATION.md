# Guía de Validación - Ticket IAC-000

Esta guía contiene los pasos para validar que el ticket IAC-000 está completo y listo para despliegue.

## ✅ Checklist de Validación

### 1. Compilación y Sintetización

```bash
# Compilar TypeScript
npm run build

# Verificar que compile sin errores
# Debe mostrar solo warnings de cdk-nag (no errores de compilación)
```

**Resultado esperado:** Compilación exitosa sin errores TypeScript.

---

### 2. Validación con cdk-nag

```bash
# Ejecutar validaciones de seguridad
npm run cdk:nag -- --context env=dev
```

**Resultado esperado:**
- ❌ No debe haber errores `High` o `Critical`
- ⚠️ Warnings de `CdkNagValidationFailure` son aceptables (son limitaciones de validación)
- ✅ Todas las supresiones deben tener justificaciones documentadas

---

### 3. Sintetización de CloudFormation

```bash
# Sintetizar templates de CloudFormation
npm run cdk:synth -- --context env=dev
```

**Resultado esperado:**
- Templates de CloudFormation generados en `cdk.out/`
- No debe haber errores de sintetización
- El único error aceptable es el de credenciales AWS si no están configuradas

**Verificar que se crean:**
- `SotruxAutoVpc-dev.template.json`
- `SotruxAutoIam-dev.template.json`

---

### 4. Verificación de Tags

Revisar que todos los recursos tengan los tags estándar:

```bash
# Buscar en los templates generados
grep -r "App.*sotrux-auto" cdk.out/
grep -r "Env.*dev" cdk.out/
grep -r "Owner.*devops@sotrux" cdk.out/
grep -r "CostCenter.*saas-core" cdk.out/
```

**Tags requeridos:**
- `App=sotrux-auto`
- `Env={dev|stg|prod}`
- `Owner=devops@sotrux`
- `CostCenter=saas-core`

---

### 5. Validación de VPC

**Recursos esperados en VPC Stack:**
- ✅ VPC con CIDR 10.0.0.0/16
- ✅ 2 subredes públicas (1 por AZ)
- ✅ 2 subredes privadas (1 por AZ)
- ✅ 1 NAT Gateway
- ✅ 1 Internet Gateway
- ✅ VPC Endpoints:
  - SSM
  - Secrets Manager
  - CloudWatch Logs
  - ECR API
  - ECR Docker
  - S3 (Gateway)

**Verificar en el template:**
```bash
# Contar subredes
grep -c "Type.*AWS::EC2::Subnet" cdk.out/SotruxAutoVpc-dev.template.json
# Debe ser 4 (2 públicas + 2 privadas)

# Verificar NAT Gateway
grep -c "Type.*AWS::EC2::NatGateway" cdk.out/SotruxAutoVpc-dev.template.json
# Debe ser 1
```

---

### 6. Validación de Roles IAM

**Roles esperados en IAM Stack:**
- ✅ GitHub OIDC Role (opcional, solo si se configura)
- ✅ ECS Task Execution Role
- ✅ ECS Task Role

**Verificar permisos mínimos:**
- ✅ ECS Task Execution Role: ECR, CloudWatch Logs, Secrets Manager, SSM
- ✅ ECS Task Role: SSM, Secrets Manager, CloudWatch Logs
- ✅ Sin wildcards innecesarios (excepto donde esté justificado)

---

### 7. Validación de cdk diff (Después del Primer Deploy)

```bash
# Después del primer deploy, verificar que no haya cambios
npm run cdk:diff -- --context env=dev
```

**Resultado esperado después del deploy inicial:**
- "No changes" o "There were no differences"

---

### 8. Validación de Bootstrap

**Antes del primer deploy, verificar bootstrap:**

```bash
# Verificar si la cuenta/región está bootstraped
aws cloudformation describe-stacks --stack-name CDKToolkit --region us-east-2

# Si no existe, hacer bootstrap
npm run cdk:bootstrap -- --context env=dev
```

**Recursos bootstrap requeridos:**
- S3 bucket para assets
- IAM roles para CDK deployments
- CloudFormation execution roles

---

## 📋 Criterios de Aceptación del Ticket

### ✅ Criterio 1: Deploy Exitoso
- **Dado:** Se ejecuta `cdk deploy`
- **Cuando:** Se aplica el stack
- **Entonces:** La VPC, endpoints y roles base se crean exitosamente

**Validación:**
```bash
npm run cdk:deploy -- --context env=dev
```

### ✅ Criterio 2: Permisos IAM Mínimos
- **Dado:** Un servicio ECS consume los roles creados
- **Cuando:** Los use
- **Entonces:** Tiene permisos mínimos y seguros

**Validación:**
- Revisar policies de los roles ECS
- Verificar que solo tienen permisos necesarios
- Confirmar que wildcards están justificados

### ✅ Criterio 3: cdk diff Sincronizado
- **Dado:** Se ejecuta `cdk diff`
- **Cuando:** No hay cambios
- **Entonces:** La configuración está sincronizada

**Validación:**
```bash
npm run cdk:diff -- --context env=dev
```

### ✅ Criterio 4: cdk-nag Sin Findings High
- **Dado:** Se ejecuta `cdk-nag`
- **Cuando:** No se reportan findings High
- **Entonces:** Cumple las políticas de seguridad

**Validación:**
```bash
npm run cdk:nag -- --context env=dev
```

---

## 🚀 Pasos para Primer Despliegue

1. **Configurar credenciales AWS:**
```bash
aws configure
# O usar AWS_PROFILE
export AWS_PROFILE=your-profile
```

2. **Configurar account ID:**
```bash
export CDK_DEFAULT_ACCOUNT=YOUR_ACCOUNT_ID
export CDK_DEFAULT_REGION=us-east-2
```

3. **Bootstrap CDK (solo primera vez):**
```bash
npm run cdk:bootstrap -- --context env=dev
```

4. **Validar sintetización:**
```bash
npm run build
npm run cdk:synth -- --context env=dev
```

5. **Validar con cdk-nag:**
```bash
npm run cdk:nag -- --context env=dev
```

6. **Desplegar VPC Stack:**
```bash
npm run cdk:deploy -- --context env=dev SotruxAutoVpc-dev
```

7. **Desplegar IAM Stack:**
```bash
npm run cdk:deploy -- --context env=dev SotruxAutoIam-dev
```

8. **Verificar que no hay cambios:**
```bash
npm run cdk:diff -- --context env=dev
```

---

## 📝 Notas de Troubleshooting

### Error: "Need to perform AWS calls but no credentials"
- Configurar credenciales AWS con `aws configure`
- O usar `AWS_PROFILE` environment variable

### Error: "Stack ... does not exist"
- Ejecutar bootstrap primero
- Verificar que el stack no esté en otra región

### Warnings de cdk-nag sobre VPC Endpoints
- Los warnings de `CdkNagValidationFailure` son conocidos y aceptables
- Se deben a limitaciones de validación cuando se usan valores intrínsecos de CloudFormation

### Error: "GitHub OIDC provider not found"
- El OIDC provider debe crearse primero manualmente
- Ver: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
- O crear el role sin GitHub config (será opcional)

---

## ✅ Definition of Done (DoD)

- [x] CDK compilado y sintetizado sin errores
- [ ] Despliegue exitoso de la VPC, endpoints y roles
- [x] Validación de permisos IAM mínima con `cdk-nag` (sin findings High)
- [x] Recursos correctamente etiquetados
- [ ] `cdk diff` sin cambios posteriores al despliegue inicial

---

## 🎯 Resultado Esperado

Infraestructura mínima desplegable y segura para los entornos `dev`, `stg` y `prd`, con:
- ✅ VPC aislada con subredes públicas y privadas
- ✅ VPC Endpoints críticos configurados
- ✅ Roles IAM base con permisos mínimos
- ✅ Validaciones automáticas de seguridad
- ✅ Base técnica para siguientes tickets de infraestructura

