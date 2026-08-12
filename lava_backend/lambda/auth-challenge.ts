import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createWalletChallenge,
  getJwtConfigError,
  isLikelyCardanoAddress,
  jsonResponse,
  parseJsonBody,
  verifyOriginRequest,
} from './security';

type ChallengeRequest = {
  address?: string;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const originCheck = await verifyOriginRequest(event);
  if (!originCheck.ok) {
    return originCheck.response;
  }

  const body = parseJsonBody<ChallengeRequest>(event);
  const address = body?.address?.trim() ?? '';

  if (!isLikelyCardanoAddress(address)) {
    return jsonResponse(400, { error: 'Valid wallet address is required' }, originCheck.origin);
  }

  const configError = getJwtConfigError(originCheck.origin);
  if (configError) {
    return configError;
  }

  try {
    const challenge = await createWalletChallenge(address);
    return jsonResponse(200, challenge, originCheck.origin);
  } catch (error) {
    console.error(error);
    return jsonResponse(500, { error: 'Unable to create challenge' }, originCheck.origin);
  }
};