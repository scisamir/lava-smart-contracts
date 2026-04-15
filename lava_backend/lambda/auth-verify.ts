import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { DataSignature } from '@meshsdk/common';
import {
  isLikelyCardanoAddress,
  issueAccessToken,
  jsonResponse,
  parseJsonBody,
  verifyOriginRequest,
  verifyWalletChallenge,
} from './security';

type VerifyRequest = {
  address?: string;
  challengeToken?: string;
  signature?: DataSignature;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const originCheck = await verifyOriginRequest(event);
  if (!originCheck.ok) {
    return originCheck.response;
  }

  const body = parseJsonBody<VerifyRequest>(event);
  const address = body?.address?.trim() ?? '';
  const challengeToken = body?.challengeToken ?? '';
  const signature = body?.signature;

  if (!isLikelyCardanoAddress(address)) {
    return jsonResponse(400, { error: 'Valid wallet address is required' }, originCheck.origin);
  }

  const isValid = await verifyWalletChallenge(address, challengeToken, signature as DataSignature);
  if (!isValid) {
    return jsonResponse(401, { error: 'Invalid wallet signature' }, originCheck.origin);
  }

  try {
    const accessToken = await issueAccessToken(address);
    return jsonResponse(200, accessToken, originCheck.origin);
  } catch (error) {
    console.error(error);
    return jsonResponse(500, { error: 'Unable to issue access token' }, originCheck.origin);
  }
};