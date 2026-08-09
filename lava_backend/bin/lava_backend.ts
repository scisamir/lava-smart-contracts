#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib/core';
import { LavaBackendStack } from '../lib/lava_backend-stack';

const app = new cdk.App();
const configuredNetwork = process.env.LAVA_NETWORK?.trim().toLowerCase();

if (configuredNetwork !== 'preprod' && configuredNetwork !== 'mainnet') {
  throw new Error('LAVA_NETWORK must be either "preprod" or "mainnet"');
}

if (configuredNetwork === 'mainnet') {
  new LavaBackendStack(app, 'LavaBackendCompanyMainnetStack', {
    stackName: 'LavaBackendCompanyMainnetStack',
    lavaNetwork: configuredNetwork,
  });
} else {
  new LavaBackendStack(app, 'LavaBackendStack', {
    lavaNetwork: configuredNetwork,
    /* If you don't specify 'env', this stack will be environment-agnostic.
     * Account/Region-dependent features and context lookups will not work,
     * but a single synthesized template can be deployed anywhere. */

    /* Uncomment the next line to specialize this stack for the AWS Account
     * and Region that are implied by the current CLI configuration. */
    // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

    /* Uncomment the next line if you know exactly what Account and Region you
     * want to deploy the stack to. */
    // env: { account: '123456789012', region: 'us-east-1' },

    /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  });
}
