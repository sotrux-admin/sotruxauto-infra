#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/stacks/vpc-stack';
import { IamStack } from '../lib/stacks/iam-stack';

const app = new cdk.App();

// Configuración de entornos
const environments = {
  dev: {
    account: process.env.CDK_DEFAULT_ACCOUNT || 'YOUR_DEV_ACCOUNT_ID',
    region: 'us-east-2',
  },
  stg: {
    account: process.env.CDK_DEFAULT_ACCOUNT || 'YOUR_STG_ACCOUNT_ID',
    region: 'us-east-2',
  },
  prod: {
    account: process.env.CDK_DEFAULT_ACCOUNT || 'YOUR_PROD_ACCOUNT_ID',
    region: 'us-east-2',
  },
};

// Obtener el entorno desde el contexto o usar 'dev' por defecto
const envName = app.node.tryGetContext('env') || 'dev';
const env = environments[envName as keyof typeof environments];

if (!env) {
  throw new Error(`Entorno desconocido: ${envName}. Usa: dev, stg, o prod`);
}

// Configuración opcional de GitHub OIDC (desde contexto o variables de entorno)
const githubRepository = app.node.tryGetContext('github-repository') || process.env.GITHUB_REPOSITORY;

// Branches permitidos por ambiente
const branchesByEnv: Record<string, string> = {
  dev: 'dev',
  stg: 'staging',
  prod: 'main',
};

// Obtener branch desde contexto, variable de entorno, o usar el default del ambiente
const githubBranch = app.node.tryGetContext('github-branch') || 
                     process.env.GITHUB_BRANCH || 
                     branchesByEnv[envName] || 
                     '*';

const githubConfig = githubRepository
  ? {
      repository: githubRepository,
      branches: githubBranch,
    }
  : undefined;

// Crear stacks
new VpcStack(app, `SotruxAutoVpc-${envName}`, {
  env,
  envName,
  description: `VPC base para Sotrux Auto - ${envName}`,
});

new IamStack(app, `SotruxAutoIam-${envName}`, {
  env,
  envName,
  description: `Roles IAM base para Sotrux Auto - ${envName}`,
  githubConfig,
});

// Aplicar tags estándar a la app completa
import { applyStandardTags } from '../lib/utils/tags';
applyStandardTags(app, envName);

