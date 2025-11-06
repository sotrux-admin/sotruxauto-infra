import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { applyStandardTags } from '../utils/tags';

export interface VpcConstructProps {
  /**
   * Nombre del entorno (dev, stg, prod)
   */
  envName: string;
  /**
   * CIDR block para la VPC
   * @default 10.0.0.0/16
   */
  cidr?: string;
}

/**
 * Construct que crea una VPC con subredes públicas y privadas,
 * NAT Gateway, y VPC Endpoints esenciales
 */
export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly privateSubnets: ec2.ISubnet[];

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    const cidr = props.cidr || '10.0.0.0/16';

    // 1. CREAR VPC BASE
    // - CIDR: 10.0.0.0/16 (65,536 direcciones IP)
    // - Habilitar DNS hostnames y DNS resolution para resolución de nombres
    // - Máximo de Availability Zones: 2
    // - NAT Gateways: 1 (MVP - control de costos)
    //   * CDK creará automáticamente 1 NAT Gateway en la primera subred pública
    //   * Costo: ~$32/mes + costos de transferencia de datos
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `sotrux-auto-vpc-${props.envName}`,
      ipAddresses: ec2.IpAddresses.cidr(cidr),
      maxAzs: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: 1, // 1 NAT Gateway para MVP (control de costos)
      subnetConfiguration: [
        {
          // 2. SUBNETS PÚBLICAS
          // - 2 subredes (1 por AZ)
          // - CIDR: 10.0.1.0/24 (AZ-A) y 10.0.2.0/24 (AZ-B)
          // - Propósito: NAT Gateway, Load Balancers públicos
          // - Enrutamiento: Internet Gateway (acceso público directo)
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          // 3. SUBNETS PRIVADAS
          // - 2 subredes (1 por AZ)
          // - CIDR: 10.0.11.0/24 (AZ-A) y 10.0.12.0/24 (AZ-B)
          // - Propósito: ECS Tasks, RDS, recursos aislados
          // - Enrutamiento: NAT Gateway (salida a Internet, sin entrada pública)
          //   * CDK configura automáticamente las route tables para usar el NAT Gateway
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // 4. INTERNET GATEWAY
    // - Creado automáticamente por CDK al usar SubnetType.PUBLIC
    // - Permite acceso público a la VPC
    // - Asociado automáticamente a las subredes públicas
    // - Las route tables públicas tienen ruta automática: 0.0.0.0/0 -> Internet Gateway

    // 5. NAT GATEWAY
    // - Creado automáticamente por CDK (natGateways: 1)
    // - Ubicación: Primera subred pública (AZ-A)
    // - EIP: Asignado automáticamente por CDK
    // - Las route tables privadas tienen ruta automática: 0.0.0.0/0 -> NAT Gateway

    // 6. ROUTE TABLES
    // - Públicas: Ruta 0.0.0.0/0 -> Internet Gateway (creado automáticamente)
    // - Privadas: Ruta 0.0.0.0/0 -> NAT Gateway (creado automáticamente)

    // Guardar referencias para uso externo
    const publicSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PUBLIC,
    }).subnets;
    const privateSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    }).subnets;

    this.publicSubnets = publicSubnets;
    this.privateSubnets = privateSubnets;

    // NAT Gateway es creado y gestionado automáticamente por CDK
    // No necesitamos exponerlo ya que las route tables se configuran automáticamente

    // 7. VPC ENDPOINTS (Interface Endpoints)
    // Ubicación: Subredes privadas (ambas AZs para alta disponibilidad)
    // Propósito: Acceso a servicios AWS sin salir por Internet (evita costos NAT, mejora seguridad)

    // 7.1. SSM (Systems Manager) Endpoint
    // - Permite gestión de instancias EC2 sin necesidad de SSH/Internet
    // - Usado por ECS para ejecutar comandos y gestión
    this.vpc.addInterfaceEndpoint('SsmEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      privateDnsEnabled: true, // Habilitar DNS privado para resolución automática
    });

    // 7.2. Secrets Manager Endpoint
    // - Permite acceso seguro a secretos almacenados en AWS Secrets Manager
    // - Usado por ECS Tasks para obtener credenciales, API keys, etc.
    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      privateDnsEnabled: true,
    });

    // 7.3. CloudWatch Logs Endpoint
    // - Permite enviar logs a CloudWatch sin salir por Internet
    // - Usado por ECS Tasks, Lambda, y otros servicios para logging
    this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      privateDnsEnabled: true,
    });

    // 7.4. ECR API Endpoint
    // - Permite autenticación con ECR (Docker registry de AWS)
    // - Necesario para que ECS Tasks puedan autenticarse y hacer pull de imágenes
    this.vpc.addInterfaceEndpoint('EcrApiEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      privateDnsEnabled: true,
    });

    // 7.5. ECR Docker Endpoint
    // - Permite hacer pull de imágenes Docker desde ECR
    // - Complementa el ECR API endpoint para operaciones completas de ECR
    this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      privateDnsEnabled: true,
    });

    // 7.6. S3 Gateway Endpoint (GRATIS)
    // - Permite acceso a S3 sin salir por Internet
    // - Tipo Gateway (no Interface) = no tiene costo adicional
    // - Usado para almacenar artifacts, logs, backups
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [
        {
          subnets: privateSubnets,
        },
      ],
    });

    // 8. SECURITY GROUPS
    // - CDK usa los security groups por defecto de AWS
    // - Se pueden crear security groups específicos en stacks posteriores
    // - Por ahora, la VPC usa el security group por defecto que permite
    //   tráfico interno dentro de la VPC

    // Aplicar tags estándar
    applyStandardTags(this, props.envName);
  }
}

