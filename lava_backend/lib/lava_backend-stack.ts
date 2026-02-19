import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class LavaBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Retrieve Maestro API key from SSM Parameter Store
    const maestroApiKey = ssm.StringParameter.valueForStringParameter(
      this,
      '/lava/maestro-api-key'
    );

    // DynamoDB table
    const table = new dynamodb.Table(this, 'LavaDataTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // ✅ Lambda Layer (Mesh + AWS SDK dependencies)
    // Temporarily removed due to size limits - dependencies included in Lambda code
    // const backendLayer = new lambda.LayerVersion(this, 'BackendLayer', {
    //   code: lambda.Code.fromAsset('lambda-layer'),
    //   compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
    //   description: 'Shared dependencies (Mesh SDK, AWS SDK)',
    // });

    // ======================
    // Lambdas
    // ======================

    const getUserBalanceLambda = new lambda.Function(this, 'GetUserBalanceFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda/dist'),
      handler: 'get-user-st-balance.handler',
      // layers: [backendLayer],
      environment: {
        MAESTRO_API_KEY: maestroApiKey,
        TABLE_NAME: table.tableName,
      },
    });

    const getMarketsLambda = new lambda.Function(this, 'GetMarketsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda/dist'),
      handler: 'get-markets.handler',
      // layers: [backendLayer],
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    const getLavaVaultsLambda = new lambda.Function(this, 'GetLavaVaultsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda/dist'),
      handler: 'get-lava-vaults.handler',
      // layers: [backendLayer],
      environment: {
        MAESTRO_API_KEY: maestroApiKey,
        TABLE_NAME: table.tableName,
      },
    });

    // Permissions
    table.grantReadWriteData(getUserBalanceLambda);
    table.grantReadWriteData(getMarketsLambda);
    table.grantReadWriteData(getLavaVaultsLambda);

    // ======================
    // API Gateway
    // ======================

    const api = new apigateway.RestApi(this, 'LavaApi', {
      restApiName: 'lava-api',
      description: 'API for Lava DeFi app',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const balanceResource = api.root.addResource('user-balance');
    balanceResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getUserBalanceLambda),
      {
        requestParameters: {
          'method.request.querystring.address': true,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
        ],
      }
    );

    const marketsResource = api.root.addResource('markets');
    marketsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getMarketsLambda),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
        ],
      }
    );

    const vaultsResource = api.root.addResource('lava-vaults');
    vaultsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getLavaVaultsLambda),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
        ],
      }
    );
  }
}
