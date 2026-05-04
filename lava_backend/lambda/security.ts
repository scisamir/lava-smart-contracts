import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { checkSignature } from '@meshsdk/core';
import { addressToBech32, deserializeAddress as cstDeserializeAddress } from '@meshsdk/core-cst';
import { jwtVerify, SignJWT } from 'jose';
import type { DataSignature } from '@meshsdk/common';

type OriginResult =
  | { ok: true; origin: string | null }
  | { ok: false; response: APIGatewayProxyResult };

type AccessTokenResult =
  | { ok: true; origin: string | null; address: string }
  | { ok: false; response: APIGatewayProxyResult };

type ChallengeClaims = {
  type: 'wallet-challenge';
  nonce: string;
};

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const _jwtSecret = process.env.JWT_SHARED_SECRET?.trim() || '';
if (!_jwtSecret) {
  console.warn(
    '[security] JWT_SHARED_SECRET is not set;'
  );
}
const JWT_SHARED_SECRET = _jwtSecret;
const JWT_ISSUER = process.env.JWT_ISSUER ?? 'lava-backend';
const ACCESS_TOKEN_AUDIENCE = process.env.JWT_AUDIENCE ?? 'lava-client';
const CHALLENGE_TOKEN_AUDIENCE = `${ACCESS_TOKEN_AUDIENCE}:challenge`;
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
const CHALLENGE_TOKEN_TTL_SECONDS = Number(process.env.CHALLENGE_TOKEN_TTL_SECONDS ?? 300);

const getJwtSecret = (): Uint8Array => new TextEncoder().encode(JWT_SHARED_SECRET);

const getHeader = (event: APIGatewayProxyEvent, headerName: string): string => {
  const lowerName = headerName.toLowerCase();

  for (const [key, value] of Object.entries(event.headers)) {
    if (key.toLowerCase() === lowerName && typeof value === 'string') {
      return value;
    }
  }

  return '';
};

export const resolveAllowedOrigin = (event: APIGatewayProxyEvent): string | null => {
  const origin = event.headers.origin ?? event.headers.Origin ?? '';
  if (!origin) {
    return null;
  }

  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
};

const hasDisallowedOrigin = (event: APIGatewayProxyEvent): boolean => {
  const origin = event.headers.origin ?? event.headers.Origin ?? '';
  return Boolean(origin) && !ALLOWED_ORIGINS.includes(origin);
};

export const corsHeaders = (origin: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
};

export const jsonResponse = (
  statusCode: number,
  body: unknown,
  origin: string | null
): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    ...corsHeaders(origin),
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
  },
  body: JSON.stringify(body),
});

export const verifyOriginRequest = async (
  event: APIGatewayProxyEvent
): Promise<OriginResult> => {
  const origin = resolveAllowedOrigin(event);

  if (hasDisallowedOrigin(event)) {
    return {
      ok: false,
      response: jsonResponse(403, { error: 'Origin not allowed' }, null),
    };
  }

  return { ok: true, origin };
};

const ensureJwtConfigured = (origin: string | null): APIGatewayProxyResult | null => {
  if (JWT_SHARED_SECRET) {
    return null;
  }

  return jsonResponse(500, { error: 'JWT auth not configured' }, origin);
};

export const getJwtConfigError = (origin: string | null): APIGatewayProxyResult | null =>
  ensureJwtConfigured(origin);

const parseBearerToken = (authorization: string): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

export const verifyAccessToken = async (
  event: APIGatewayProxyEvent
): Promise<AccessTokenResult> => {
  const originCheck = await verifyOriginRequest(event);
  if (!originCheck.ok) {
    return originCheck;
  }

  const configError = ensureJwtConfigured(originCheck.origin);
  if (configError) {
    return { ok: false, response: configError };
  }

  const token = parseBearerToken(getHeader(event, 'authorization'));
  if (!token) {
    return {
      ok: false,
      response: jsonResponse(401, { error: 'Missing bearer token' }, originCheck.origin),
    };
  }

  try {
    const verified = await jwtVerify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });

    const address = typeof verified.payload.sub === 'string' ? verified.payload.sub : '';
    if (!isLikelyCardanoAddress(address)) {
      return {
        ok: false,
        response: jsonResponse(401, { error: 'Invalid token subject' }, originCheck.origin),
      };
    }

    return { ok: true, origin: originCheck.origin, address };
  } catch {
    return {
      ok: false,
      response: jsonResponse(401, { error: 'Invalid authorization token' }, originCheck.origin),
    };
  }
};

const buildChallengeMessage = (address: string, nonce: string, expiresAtIso: string): string =>
  [
    'Lava wallet authentication',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `ExpiresAt: ${expiresAtIso}`,
  ].join('\n');

const toHex = (value: string): string => Buffer.from(value, 'utf8').toString('hex');

const normalizeCardanoAddress = (address: string): string => {
  try {
    return addressToBech32(cstDeserializeAddress(address));
  } catch {
    return address;
  }
};

export const createWalletChallenge = async (address: string) => {
  const normalizedAddress = normalizeCardanoAddress(address);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + CHALLENGE_TOKEN_TTL_SECONDS;
  const expiresAtIso = new Date(expiresAt * 1000).toISOString();
  const nonce = randomUUID();

  const challengeToken = await new SignJWT({
    type: 'wallet-challenge',
    nonce,
  } satisfies ChallengeClaims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setIssuer(JWT_ISSUER)
    .setAudience(CHALLENGE_TOKEN_AUDIENCE)
    .setSubject(normalizedAddress)
    .setExpirationTime(expiresAt)
    .sign(getJwtSecret());

  return {
    challengeToken,
    message: buildChallengeMessage(normalizedAddress, nonce, expiresAtIso),
    expiresAt: expiresAtIso,
  };
};

export const verifyWalletChallenge = async (
  address: string,
  challengeToken: string,
  signature: DataSignature
): Promise<boolean> => {
  if (!challengeToken || !signature?.key || !signature?.signature) {
    return false;
  }

  if (!JWT_SHARED_SECRET) {
    return false;
  }

  const normalizedAddress = normalizeCardanoAddress(address);

  try {
    const verified = await jwtVerify(challengeToken, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: CHALLENGE_TOKEN_AUDIENCE,
      subject: normalizedAddress,
    });

    const nonce = typeof verified.payload.nonce === 'string' ? verified.payload.nonce : '';
    if (!nonce) {
      return false;
    }

    const expiresAt = typeof verified.payload.exp === 'number' ? verified.payload.exp : 0;
    const expiresAtIso = new Date(expiresAt * 1000).toISOString();
    const message = buildChallengeMessage(normalizedAddress, nonce, expiresAtIso);
    return checkSignature(toHex(message), signature, normalizedAddress);
  } catch {
    return false;
  }
};

export const issueAccessToken = async (address: string) => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;
  const expiresAtIso = new Date(expiresAt * 1000).toISOString();

  const token = await new SignJWT({
    scope: 'lava:read',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setIssuer(JWT_ISSUER)
    .setAudience(ACCESS_TOKEN_AUDIENCE)
    .setSubject(address)
    .setExpirationTime(expiresAt)
    .sign(getJwtSecret());

  return {
    address,
    token,
    expiresAt: expiresAtIso,
  };
};

export const parseJsonBody = <T>(event: APIGatewayProxyEvent): T | null => {
  if (!event.body) {
    return null;
  }

  try {
    return JSON.parse(event.body) as T;
  } catch {
    return null;
  }
};

export const isLikelyCardanoAddress = (address: string): boolean => {
  if (!address || address.length < 20 || address.length > 200) {
    return false;
  }

  try {
    addressToBech32(cstDeserializeAddress(address));
    return true;
  } catch {
    return false;
  }
};
