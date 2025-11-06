import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { applyStandardTags } from '../utils/tags';
import { NagSuppressions } from 'cdk-nag';

export interface IamRolesConstructProps {
  /**
   * Nombre del entorno (dev, stg, prod)
   */
  envName: string;
  /**
   * Configuración del GitHub OIDC provider
   */
  githubConfig?: {
    /**
     * Repositorio de GitHub (formato: owner/repo)
     * @example "sotrux/sotruxauto-infra"
     */
    repository: string;
    /**
     * Branch o ref específico (opcional)
     * @default "*" (cualquier branch)
     */
    branch?: string;
  };
}

/**
 * Construct que crea los roles IAM base para Sotrux Auto
 */
export class IamRolesConstruct extends Construct {
  public readonly githubOidcRole?: iam.Role;
  public readonly ecsTaskExecutionRole: iam.Role;
  public readonly ecsTaskRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamRolesConstructProps) {
    super(scope, id);

    const stack = cdk.Stack.of(this);
    const account = stack.account;
    const region = stack.region;

    // 1. GITHUB OIDC → AWS ROLE (cdk-deploy-role)
    // Propósito: Permitir deployments desde GitHub Actions sin usar secretos
    // Trust Policy: OIDC provider de GitHub
    // Permisos: Mínimos necesarios para CDK deployments
    // Nota: Solo se crea si se proporciona githubConfig

    if (props.githubConfig) {
      // Obtener el OIDC provider de GitHub
      // El provider debe existir en la cuenta (se crea una vez manualmente o via CDK)
      // Para crearlo: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
      const githubOidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        this,
        'GitHubOidcProvider',
        `arn:aws:iam::${account}:oidc-provider/token.actions.githubusercontent.com`
      );

      // Crear el role para GitHub Actions
      this.githubOidcRole = new iam.Role(this, 'GitHubOidcRole', {
      roleName: `sotrux-auto-cdk-deploy-role-${props.envName}`,
      description: `Role para deployments de CDK desde GitHub Actions - ${props.envName}`,
      assumedBy: new iam.WebIdentityPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': props.githubConfig
              ? `repo:${props.githubConfig.repository}:${props.githubConfig.branch || '*'}`
              : '*',
          },
        }
      ),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Permisos mínimos para CDK deployments
    // CloudFormation: Gestión de stacks
    this.githubOidcRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudformation:CreateStack',
          'cloudformation:UpdateStack',
          'cloudformation:DeleteStack',
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:DescribeStackResource',
          'cloudformation:DescribeStackResources',
          'cloudformation:GetTemplate',
          'cloudformation:ValidateTemplate',
        ],
        resources: ['*'],
      })
    );

    // S3: Acceso al bucket de bootstrap de CDK
    this.githubOidcRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:ListBucket',
        ],
        resources: [
          `arn:aws:s3:::cdk-*-assets-${account}-${region}`,
          `arn:aws:s3:::cdk-*-assets-${account}-${region}/*`,
        ],
      })
    );

    // IAM: Permisos para crear roles y policies (necesario para recursos CDK)
    this.githubOidcRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'iam:CreateRole',
          'iam:DeleteRole',
          'iam:GetRole',
          'iam:PassRole',
          'iam:AttachRolePolicy',
          'iam:DetachRolePolicy',
          'iam:PutRolePolicy',
          'iam:DeleteRolePolicy',
          'iam:GetRolePolicy',
          'iam:TagRole',
        ],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'iam:ResourceTag/App': 'sotrux-auto',
            'iam:ResourceTag/Env': props.envName,
          },
        },
      })
    );

    // EC2/VPC: Permisos para crear recursos de infraestructura
    this.githubOidcRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ec2:*',
          'vpc:*',
          'logs:*',
          'ecs:*',
          'ecr:*',
          'secretsmanager:*',
          'ssm:*',
          'apigateway:*',
          'cloudfront:*',
          'route53:*',
          'acm:*',
        ],
        resources: ['*'],
      })
    );

      // STS: Para asumir roles (si es necesario)
      this.githubOidcRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['sts:AssumeRole'],
          resources: ['*'],
        })
      );
    }

    // 2. ECS TASK EXECUTION ROLE
    // Propósito: Permite a ECS ejecutar tareas
    // Permisos: ECR (pull imágenes), CloudWatch Logs (logs), Secrets Manager y SSM (variables de entorno)

    this.ecsTaskExecutionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      roleName: `sotrux-auto-ecs-task-execution-role-${props.envName}`,
      description: `Role para ejecución de tareas ECS - ${props.envName}`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        // Policy de AWS para ECS Task Execution (incluye ECR y CloudWatch Logs)
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy'
        ),
      ],
    });

    // Permisos adicionales para Secrets Manager (leer secretos para variables de entorno)
    this.ecsTaskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        resources: [
          `arn:aws:secretsmanager:${region}:${account}:secret:sotrux-auto-${props.envName}-*`,
        ],
      })
    );

    // Permisos para SSM Parameter Store (leer parámetros para variables de entorno)
    this.ecsTaskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ssm:GetParameters',
          'ssm:GetParameter',
          'ssm:GetParametersByPath',
        ],
        resources: [
          `arn:aws:ssm:${region}:${account}:parameter/sotrux-auto/${props.envName}/*`,
        ],
      })
    );

    // Supresiones de cdk-nag para wildcards necesarios
    NagSuppressions.addResourceSuppressions(
      this.ecsTaskExecutionRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcards necesarios para acceso a secretos y parámetros bajo prefijo específico por entorno. Los recursos están restringidos por prefijo de entorno.',
          appliesTo: [
            `Resource::arn:aws:secretsmanager:${region}:${account}:secret:sotrux-auto-${props.envName}-*`,
            `Resource::arn:aws:ssm:${region}:${account}:parameter/sotrux-auto/${props.envName}/*`,
          ],
        },
      ],
      true
    );

    // 3. ECS TASK ROLE
    // Propósito: Permisos para la aplicación en ejecución dentro del contenedor
    // Permisos: Lectura de SSM y Secrets Manager para la aplicación

    this.ecsTaskRole = new iam.Role(this, 'EcsTaskRole', {
      roleName: `sotrux-auto-ecs-task-role-${props.envName}`,
      description: `Role para tareas ECS (permisos de aplicación) - ${props.envName}`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Permisos para SSM Parameter Store (lectura de parámetros)
    this.ecsTaskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ssm:GetParameters',
          'ssm:GetParameter',
          'ssm:GetParametersByPath',
        ],
        resources: [
          `arn:aws:ssm:${region}:${account}:parameter/sotrux-auto/${props.envName}/*`,
        ],
      })
    );

    // Permisos para Secrets Manager (lectura de secretos)
    this.ecsTaskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        resources: [
          `arn:aws:secretsmanager:${region}:${account}:secret:sotrux-auto-${props.envName}-*`,
        ],
      })
    );

    // Permisos para CloudWatch Logs (opcional - para logging desde la aplicación)
    this.ecsTaskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          `arn:aws:logs:${region}:${account}:log-group:/ecs/sotrux-auto-${props.envName}*`,
        ],
      })
    );

    // Supresiones de cdk-nag para wildcards necesarios
    NagSuppressions.addResourceSuppressions(
      this.ecsTaskRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcards necesarios para acceso a secretos, parámetros y logs bajo prefijo específico por entorno. Los recursos están restringidos por prefijo de entorno.',
          appliesTo: [
            `Resource::arn:aws:secretsmanager:${region}:${account}:secret:sotrux-auto-${props.envName}-*`,
            `Resource::arn:aws:ssm:${region}:${account}:parameter/sotrux-auto/${props.envName}/*`,
            `Resource::arn:aws:logs:${region}:${account}:log-group:/ecs/sotrux-auto-${props.envName}*`,
          ],
        },
      ],
      true
    );

    // Aplicar tags estándar
    applyStandardTags(this, props.envName);
  }
}

