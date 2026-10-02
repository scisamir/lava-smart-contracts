import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import type { LavaNetwork } from "../lambda/cardano";

export interface LavaBackendStackProps extends cdk.StackProps {
  lavaNetwork: LavaNetwork;
}

export class LavaBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LavaBackendStackProps) {
    const { lavaNetwork, ...stackProps } = props;
    super(scope, id, stackProps);

    const ssmPrefix = lavaNetwork === "preprod" ? "/lava" : "/lava/mainnet";

    const allowedOrigins = (
      process.env.ALLOWED_ORIGINS ?? "http://localhost:3000"
    )
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const jwtSharedSecret = ssm.StringParameter.valueForStringParameter(
      this,
      `${ssmPrefix}/backend-jwt-shared-secret`,
    );

    const jwtIssuer = process.env.JWT_ISSUER ?? "lava-backend";
    const jwtAudience = process.env.JWT_AUDIENCE ?? "lava-client";
    const authAdminAddresses = process.env.AUTH_ADMIN_ADDRESSES ?? "";

    // Retrieve Maestro API key from SSM Parameter Store
    const maestroApiKey = ssm.StringParameter.valueForStringParameter(
      this,
      `${ssmPrefix}/maestro-api-key`,
    );

    const batcherWalletPassphrase = ssm.StringParameter.valueForStringParameter(
      this,
      `${ssmPrefix}/batcher-wallet-passphrase-string`,
    );

    const cardanoEnvironment = {
      LAVA_NETWORK: lavaNetwork,
      MAESTRO_API_KEY: maestroApiKey,
    };

    // DynamoDB table
    const table = new dynamodb.Table(this, "LavaDataTable", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Lambda Layer (Mesh + AWS SDK dependencies)
    // Temporarily removed due to size limits - dependencies included in Lambda code
    // const backendLayer = new lambda.LayerVersion(this, 'BackendLayer', {
    //   code: lambda.Code.fromAsset('lambda-layer'),
    //   compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
    //   description: 'Shared dependencies (Mesh SDK, AWS SDK)',
    // });

    // ======================
    // Lambdas
    // ======================

    const authChallengeLambda = new lambda.Function(
      this,
      "AuthChallengeFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "auth-challenge.handler",
        environment: {
          ALLOWED_ORIGINS: allowedOrigins.join(","),
          JWT_SHARED_SECRET: jwtSharedSecret,
          JWT_ISSUER: jwtIssuer,
          JWT_AUDIENCE: jwtAudience,
        },
      },
    );

    const authVerifyLambda = new lambda.Function(this, "AuthVerifyFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromAsset("lambda/dist"),
      handler: "auth-verify.handler",
      environment: {
        ALLOWED_ORIGINS: allowedOrigins.join(","),
        JWT_SHARED_SECRET: jwtSharedSecret,
        JWT_ISSUER: jwtIssuer,
        JWT_AUDIENCE: jwtAudience,
        AUTH_ADMIN_ADDRESSES: authAdminAddresses,
      },
    });

    const getUserBalanceLambda = new lambda.Function(
      this,
      "GetUserBalanceFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "get-user-st-balance.handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        // layers: [backendLayer],
        environment: {
          ...cardanoEnvironment,
          TABLE_NAME: table.tableName,
          ALLOWED_ORIGINS: allowedOrigins.join(","),
          JWT_SHARED_SECRET: jwtSharedSecret,
          JWT_ISSUER: jwtIssuer,
          JWT_AUDIENCE: jwtAudience,
        },
      },
    );

    const getMarketsLambda = new lambda.Function(this, "GetMarketsFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromAsset("lambda/dist"),
      handler: "get-markets.handler",
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      // layers: [backendLayer],
      environment: {
        TABLE_NAME: table.tableName,
        ALLOWED_ORIGINS: allowedOrigins.join(","),
      },
    });

    const getLavaVaultsLambda = new lambda.Function(
      this,
      "GetLavaVaultsFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "get-lava-vaults.handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        // layers: [backendLayer],
        environment: {
          TABLE_NAME: table.tableName,
          ALLOWED_ORIGINS: allowedOrigins.join(","),
        },
      },
    );

    const syncLavaVaultsLambda = new lambda.Function(
      this,
      "SyncLavaVaultsFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "sync-lava-vaults.handler",
        timeout: cdk.Duration.seconds(60),
        memorySize: 1024,
        environment: {
          ...cardanoEnvironment,
          TABLE_NAME: table.tableName,
        },
      },
    );

    const upsertTokenMetadataLambda = new lambda.Function(
      this,
      "UpsertTokenMetadataFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "upsert-token-metadata.handler",
        environment: {
          TABLE_NAME: table.tableName,
        },
      },
    );

    const getBatchStatsLambda = new lambda.Function(
      this,
      "GetBatchStatsFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "get-batch-stats.handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        environment: {
          ...cardanoEnvironment,
          TABLE_NAME: table.tableName,
          ALLOWED_ORIGINS: allowedOrigins.join(","),
        },
      },
    );

    const postBatchOrdersLambda = new lambda.Function(
      this,
      "PostBatchOrdersFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "post-batch-orders.handler",
        timeout: cdk.Duration.seconds(60),
        memorySize: 1024,
        environment: {
          ...cardanoEnvironment,
          TABLE_NAME: table.tableName,
          ALLOWED_ORIGINS: allowedOrigins.join(","),
          JWT_SHARED_SECRET: jwtSharedSecret,
          JWT_ISSUER: jwtIssuer,
          JWT_AUDIENCE: jwtAudience,
          BATCHER_WALLET_PASSPHRASE: batcherWalletPassphrase,
        },
      },
    );

    const autoBatchOrdersLambda = new lambda.Function(
      this,
      "AutoBatchOrdersFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "auto-batch-orders.handler",
        timeout: cdk.Duration.seconds(120),
        memorySize: 1024,
        environment: {
          ...cardanoEnvironment,
          TABLE_NAME: table.tableName,
          BATCHER_WALLET_PASSPHRASE: batcherWalletPassphrase,
        },
      },
    );

    const buildUserOrderTxLambda = new lambda.Function(
      this,
      "BuildUserOrderTxFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "build-user-order-tx.handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        environment: {
          ...cardanoEnvironment,
          TABLE_NAME: table.tableName,
          ALLOWED_ORIGINS: allowedOrigins.join(","),
          JWT_SHARED_SECRET: jwtSharedSecret,
          JWT_ISSUER: jwtIssuer,
          JWT_AUDIENCE: jwtAudience,
        },
      },
    );

    const buildMintTestTokensTxLambda = new lambda.Function(
      this,
      "BuildMintTestTokensTxFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "build-mint-test-tokens-tx.handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        environment: {
          ...cardanoEnvironment,
          TABLE_NAME: table.tableName,
          ALLOWED_ORIGINS: allowedOrigins.join(","),
          JWT_SHARED_SECRET: jwtSharedSecret,
          JWT_ISSUER: jwtIssuer,
          JWT_AUDIENCE: jwtAudience,
        },
      },
    );

    const getUserOrdersLambda = new lambda.Function(
      this,
      "GetUserOrdersFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "get-user-orders.handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        environment: {
          ...cardanoEnvironment,
          TABLE_NAME: table.tableName,
          ALLOWED_ORIGINS: allowedOrigins.join(","),
          JWT_SHARED_SECRET: jwtSharedSecret,
          JWT_ISSUER: jwtIssuer,
          JWT_AUDIENCE: jwtAudience,
        },
      },
    );

    const buildCancelOrderTxLambda = new lambda.Function(
      this,
      "BuildCancelOrderTxFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/dist"),
        handler: "build-cancel-order-tx.handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        environment: {
          ...cardanoEnvironment,
          TABLE_NAME: table.tableName,
          ALLOWED_ORIGINS: allowedOrigins.join(","),
          JWT_SHARED_SECRET: jwtSharedSecret,
          JWT_ISSUER: jwtIssuer,
          JWT_AUDIENCE: jwtAudience,
        },
      },
    );

    // Permissions
    table.grantReadWriteData(getUserBalanceLambda);
    table.grantReadWriteData(getMarketsLambda);
    table.grantReadWriteData(getLavaVaultsLambda);
    table.grantReadWriteData(syncLavaVaultsLambda);
    table.grantReadData(upsertTokenMetadataLambda);
    table.grantReadWriteData(getBatchStatsLambda);
    table.grantReadWriteData(postBatchOrdersLambda);
    table.grantReadWriteData(buildUserOrderTxLambda);
    table.grantReadWriteData(buildMintTestTokensTxLambda);
    table.grantReadWriteData(getUserOrdersLambda);
    table.grantReadWriteData(buildCancelOrderTxLambda);
    table.grantReadWriteData(autoBatchOrdersLambda);

    const vaultSyncSchedule = new events.Rule(
      this,
      "VaultSyncEveryFiveMinutes",
      {
        schedule: events.Schedule.rate(cdk.Duration.minutes(10)),
      },
    );
    vaultSyncSchedule.addTarget(
      new targets.LambdaFunction(syncLavaVaultsLambda),
    );

    const autoBatchSchedule = new events.Rule(
      this,
      "AutoBatchOrdersEveryFiveMinutes",
      {
        schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      },
    );
    autoBatchSchedule.addTarget(
      new targets.LambdaFunction(autoBatchOrdersLambda),
    );

    // ======================
    // API Gateway
    // ======================
    const api = new apigateway.RestApi(this, "LavaApi", {
      restApiName: "lava-api",
      description: "API for Lava DeFi app",
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
      },
      deployOptions: {
        throttlingRateLimit: 20,
        throttlingBurstLimit: 40,
      },
    });

    api.addGatewayResponse("Default4xxCors", {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers":
          "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS,PATCH'",
      },
    });

    api.addGatewayResponse("Default5xxCors", {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers":
          "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS,PATCH'",
      },
    });

    const authResource = api.root.addResource("auth");
    const authChallengeResource = authResource.addResource("challenge");
    authChallengeResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(authChallengeLambda),
    );

    const authVerifyResource = authResource.addResource("verify");
    authVerifyResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(authVerifyLambda),
    );

    const balanceResource = api.root.addResource("user-balance");
    balanceResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getUserBalanceLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );

    const marketsResource = api.root.addResource("markets");
    marketsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getMarketsLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );

    const vaultsResource = api.root.addResource("lava-vaults");
    vaultsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getLavaVaultsLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );

    const tokenMetadataResource = api.root.addResource("token-metadata");
    tokenMetadataResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(upsertTokenMetadataLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );

    const batchOrdersResource = api.root.addResource("batch-orders");
    batchOrdersResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(postBatchOrdersLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );

    const batchStatsResource = api.root.addResource("batch-stats");
    batchStatsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getBatchStatsLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );

    const buildUserOrderTxResource = api.root.addResource(
      "build-user-order-tx",
    );
    buildUserOrderTxResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(buildUserOrderTxLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );

    const buildMintTestTokensTxResource = api.root.addResource(
      "build-mint-test-tokens-tx",
    );
    buildMintTestTokensTxResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(buildMintTestTokensTxLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );

    const userOrdersResource = api.root.addResource("user-orders");
    userOrdersResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getUserOrdersLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );

    const buildCancelOrderTxResource = api.root.addResource(
      "build-cancel-order-tx",
    );
    buildCancelOrderTxResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(buildCancelOrderTxLambda),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      },
    );
  }
}
