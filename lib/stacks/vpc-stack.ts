import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcConstruct } from '../constructs/vpc-construct';
import { applyStandardTags } from '../utils/tags';
import { BaseStack, applyNagSuppressions } from './base-stack';

export interface VpcStackProps extends cdk.StackProps {
  envName: string;
}

export class VpcStack extends BaseStack {
  public readonly vpcConstruct: VpcConstruct;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    // Crear VPC con todos sus componentes:
    // - VPC base con subredes públicas y privadas
    // - NAT Gateway (1 para MVP)
    // - VPC Endpoints (SSM, Secrets Manager, CloudWatch Logs, ECR, S3)
    this.vpcConstruct = new VpcConstruct(this, 'VpcConstruct', {
      envName: props.envName,
    });

    // Aplicar tags estándar
    applyStandardTags(this, props.envName);

    // Aplicar supresiones de cdk-nag donde sea necesario
    // Supresión: NAT Gateway en una sola AZ (MVP - control de costos)
    applyNagSuppressions(this, [
      {
        id: 'AwsSolutions-VPC7',
        reason: 'NAT Gateway en una sola AZ para MVP - control de costos. Se puede escalar a múltiples AZs en producción.',
      },
    ]);
  }
}

