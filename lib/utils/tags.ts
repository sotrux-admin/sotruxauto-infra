import { Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Tags estándar para recursos de Sotrux Auto
 */
export interface StandardTags {
  App: string;
  Env: string;
  Owner: string;
  CostCenter: string;
}

/**
 * Aplica tags estándar a un construct y todos sus hijos
 * @param scope - El construct al que aplicar los tags
 * @param env - El entorno (dev, stg, prod)
 */
export function applyStandardTags(scope: Construct, env: string): void {
  const tags: StandardTags = {
    App: 'sotrux-auto',
    Env: env,
    Owner: 'devops@sotrux',
    CostCenter: 'saas-core',
  };

  Object.entries(tags).forEach(([key, value]) => {
    Tags.of(scope).add(key, value);
  });
}

