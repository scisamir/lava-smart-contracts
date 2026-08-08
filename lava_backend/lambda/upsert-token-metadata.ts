import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type TokenMetadataInput = {
  symbol: string;
  displayName?: string;
  policyId?: string;
  assetNameHex?: string;
  decimals?: number;
  logo?: string;
  underlyingSymbol?: string;
  underlyingDisplayName?: string;
  underlyingPolicyId?: string;
  underlyingAssetNameHex?: string;
  underlyingDecimals?: number;
  underlyingLogo?: string;
  isActive?: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-admin-key',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const isAuthorized = (event: APIGatewayProxyEvent): boolean => {
  const configuredKey = process.env.TOKEN_METADATA_ADMIN_KEY;
  if (!configuredKey) {
    return true;
  }

  const headerKey =
    event.headers['x-admin-key'] || event.headers['X-Admin-Key'] || '';

  return headerKey === configuredKey;
};

const normalizeInput = (input: TokenMetadataInput): TokenMetadataInput => ({
  symbol: String(input.symbol).trim(),
  displayName: input.displayName ? String(input.displayName).trim() : undefined,
  policyId: input.policyId ? String(input.policyId).trim() : undefined,
  assetNameHex: input.assetNameHex ? String(input.assetNameHex).trim() : undefined,
  decimals:
    input.decimals === undefined || input.decimals === null
      ? undefined
      : Number(input.decimals),
  logo: input.logo ? String(input.logo).trim() : undefined,
  underlyingSymbol: input.underlyingSymbol
    ? String(input.underlyingSymbol).trim()
    : undefined,
  underlyingDisplayName: input.underlyingDisplayName
    ? String(input.underlyingDisplayName).trim()
    : undefined,
  underlyingPolicyId: input.underlyingPolicyId
    ? String(input.underlyingPolicyId).trim()
    : undefined,
  underlyingAssetNameHex: input.underlyingAssetNameHex
    ? String(input.underlyingAssetNameHex).trim()
    : undefined,
  underlyingDecimals:
    input.underlyingDecimals === undefined || input.underlyingDecimals === null
      ? undefined
      : Number(input.underlyingDecimals),
  underlyingLogo: input.underlyingLogo
    ? String(input.underlyingLogo).trim()
    : undefined,
  isActive: input.isActive === undefined ? true : Boolean(input.isActive),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME is not configured');
    }

    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: '',
      };
    }

    if (event.httpMethod === 'GET') {
      const scanResult = await ddb.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: '#entityType = :entityType',
          ExpressionAttributeNames: {
            '#entityType': 'entityType',
          },
          ExpressionAttributeValues: {
            ':entityType': 'TOKEN_METADATA',
          },
        })
      );

      const tokens = (scanResult.Items ?? []).sort((a, b) =>
        String(a.symbol ?? '').localeCompare(String(b.symbol ?? ''))
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ tokens }),
      };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    if (!isAuthorized(event)) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const rawBody = event.body ? JSON.parse(event.body) : {};
    const payload = normalizeInput(rawBody as TokenMetadataInput);

    if (!payload.symbol) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'symbol is required' }),
      };
    }

    if (payload.decimals !== undefined && Number.isNaN(payload.decimals)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'decimals must be a number' }),
      };
    }

    if (
      payload.underlyingDecimals !== undefined &&
      Number.isNaN(payload.underlyingDecimals)
    ) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'underlyingDecimals must be a number' }),
      };
    }

    const item = {
      pk: `TOKEN#${payload.symbol}`,
      sk: 'META',
      entityType: 'TOKEN_METADATA',
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Token metadata upserted',
        token: item,
      }),
    };
  } catch (error) {
    console.error('upsert-token-metadata failed', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
