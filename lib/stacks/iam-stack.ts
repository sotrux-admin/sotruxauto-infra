import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IamRolesConstruct } from '../constructs/iam-roles-construct';
import { applyStandardTags } from '../utils/tags';
import { BaseStack, applyNagSuppressions } from './base-stack';

export interface IamStackProps extends cdk.StackProps {
  envName: string;
  /**
   * Configuración opcional de GitHub OIDC
   */
  githubConfig?: {
    repository: string;
    branch?: string;
  };
}

export class IamStack extends BaseStack {
  public readonly iamRolesConstruct: IamRolesConstruct;

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props);

    // Crear roles IAM base:
    // - GitHub OIDC Role (para deployments desde GitHub Actions)
    // - ECS Task Execution Role (para ejecutar tareas ECS)
    // - ECS Task Role (para permisos de aplicación)
    this.iamRolesConstruct = new IamRolesConstruct(this, 'IamRolesConstruct', {
      envName: props.envName,
      githubConfig: props.githubConfig,
    });

    // Aplicar tags estándar
    applyStandardTags(this, props.envName);

    // Aplicar supresiones de cdk-nag donde sea necesario
    // Supresión: GitHub OIDC role necesita permisos amplios para CDK deployments
    applyNagSuppressions(this, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'GitHub OIDC role necesita permisos amplios para CDK deployments. Los permisos están restringidos por tags donde es posible.',
        appliesTo: ['Resource::*'],
      },
      {
        id: 'AwsSolutions-IAM4',
        reason: 'Uso de managed policies de AWS para ECS Task Execution Role es una práctica recomendada.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcards necesarios para ECS roles - acceso a secretos y parámetros bajo prefijo específico por entorno.',
        appliesTo: [
          'Resource::arn:aws:secretsmanager:us-east-2:*:secret:sotrux-auto-*-*',
          'Resource::arn:aws:ssm:us-east-2:*:parameter/sotrux-auto/*/*',
          'Resource::arn:aws:logs:us-east-2:*:log-group:/ecs/sotrux-auto-*',
        ],
      },
    ]);
  }
}

