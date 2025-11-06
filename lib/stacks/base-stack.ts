import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { Construct, IConstruct } from 'constructs';
import { NagPackSuppression, NagSuppressions } from 'cdk-nag';
import { AwsSolutionsChecks } from 'cdk-nag';

/**
 * Stack base con validaciones de seguridad usando cdk-nag
 */
export abstract class BaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Aplicar validaciones de cdk-nag
    // AwsSolutionsChecks: Mejores prácticas de AWS
    Aspects.of(this).add(new AwsSolutionsChecks({ verbose: true }));

    // Aplicar supresiones específicas si es necesario
    // Estas se aplicarán en los stacks hijos
  }
}

/**
 * Aplicar supresiones comunes a un construct
 */
export function applyNagSuppressions(
  scope: IConstruct,
  suppressions: NagPackSuppression[]
): void {
  NagSuppressions.addStackSuppressions(scope as cdk.Stack, suppressions);
}

