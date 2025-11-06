# Sotrux Auto - Infraestructura como Código

Infraestructura de AWS para Sotrux Auto usando AWS CDK v2 en TypeScript.

## 📋 Prerrequisitos

- Node.js >= 20.x
- AWS CDK CLI >= 2.1031.1
- AWS CLI configurado con credenciales
- Cuenta AWS con permisos para crear recursos

## 🚀 Instalación

```bash
# Instalar dependencias
npm install

# Compilar TypeScript
npm run build
```

## 🏗️ Estructura del Proyecto

```
sotruxauto-infra/
├── bin/
│   └── app.ts              # Punto de entrada de CDK
├── lib/
│   ├── constructs/         # Constructs reutilizables
│   │   ├── vpc-construct.ts
│   │   └── iam-roles-construct.ts
│   ├── stacks/             # Stacks de CDK
│   │   ├── base-stack.ts   # Stack base con validaciones
│   │   ├── vpc-stack.ts
│   │   └── iam-stack.ts
│   └── utils/
│       └── tags.ts         # Utilidades para tags
├── cdk.json                # Configuración de CDK
├── package.json
└── tsconfig.json
```

## 🔧 Configuración

### Variables de Entorno

Antes de desplegar, configura las siguientes variables de entorno o actualiza los valores en `bin/app.ts`:

```bash
export CDK_DEFAULT_ACCOUNT=YOUR_ACCOUNT_ID
export CDK_DEFAULT_REGION=us-east-2
```

### Configuración de GitHub OIDC (Opcional)

Para habilitar deployments desde GitHub Actions:

```bash
# Desde contexto
cdk deploy --context env=dev --context github-repository=owner/repo --context github-branch=main

# O desde variables de entorno
export GITHUB_REPOSITORY=owner/repo
export GITHUB_BRANCH=main
```

**Nota:** El OIDC provider de GitHub debe crearse previamente en la cuenta AWS. Ver [documentación de GitHub](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services).

## 📦 Stacks

### VPC Stack (`SotruxAutoVpc-{env}`)

Crea la VPC base con:
- 2 subredes públicas y 2 privadas (2 AZs)
- 1 NAT Gateway (MVP)
- VPC Endpoints: SSM, Secrets Manager, CloudWatch Logs, ECR, S3

### IAM Stack (`SotruxAutoIam-{env}`)

Crea los roles IAM base:
- **GitHub OIDC Role**: Para deployments desde GitHub Actions
- **ECS Task Execution Role**: Para ejecutar tareas ECS
- **ECS Task Role**: Para permisos de aplicación

## 🚀 Comandos

```bash
# Compilar
npm run build

# Sintetizar CloudFormation
npm run cdk:synth -- --context env=dev

# Ver diferencias
npm run cdk:diff -- --context env=dev

# Desplegar (requiere bootstrap previo)
npm run cdk:deploy -- --context env=dev

# Validar con cdk-nag
npm run cdk:nag -- --context env=dev

# Bootstrap CDK (solo primera vez)
npm run cdk:bootstrap -- --context env=dev
```

## 🏷️ Tags Estándar

Todos los recursos se etiquetan automáticamente con:
- `App=sotrux-auto`
- `Env={dev|stg|prod}`
- `Owner=devops@sotrux`
- `CostCenter=saas-core`

## 🔒 Validaciones de Seguridad

El proyecto usa `cdk-nag` para validar mejores prácticas de seguridad:
- **AwsSolutionsChecks**: Validaciones de mejores prácticas de AWS
- Se ejecuta automáticamente en cada stack
- Ver reporte con: `npm run cdk:nag`

## 📝 Entornos

- `dev`: Desarrollo
- `stg`: Staging
- `prod`: Producción

Para especificar el entorno:
```bash
cdk deploy --context env=dev
```

## 🎯 Próximos Pasos

1. Bootstrap CDK en las cuentas AWS
2. Configurar GitHub OIDC provider (si se usa GitHub Actions)
3. Desplegar stacks en orden:
   - VPC Stack
   - IAM Stack
4. Continuar con stacks adicionales (ECS, RDS, API Gateway, CloudFront)

## 📚 Referencias

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [cdk-nag Documentation](https://github.com/cdklabs/cdk-nag)
- [GitHub OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)

