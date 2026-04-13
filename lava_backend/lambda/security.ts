// This module provides security utilities for Lambda functions:
// - JWT token verification - validates tokens from the frontend proxy
// - CORS configuration - enables specific frontend origins to call the API
// - Cardano address validation - checks if addresses are valid Cardano addresses
// - Response formatting - includes security headers in all responses

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { jwtVerify } from 'jose';
import { deserializeAddress } from '@meshsdk/core';

type AuthResult =
  | { ok: true; origin: string | null }
  | { ok: false; response: APIGatewayProxyResult };

// CORS protection: only these origins will receive responses
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

// JWT configuration - MUST match frontend settings for token verification to work
const JWT_ISSUER = process.env.JWT_ISSUER ?? 'lava-frontend';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'lava-backend';
const JWT_SHARED_SECRET = process.env.JWT_SHARED_SECRET ?? '';

const textEncoder = new TextEncoder();

export const resolveAllowedOrigin = (event: APIGatewayProxyEvent): string | null => {
  const origin = event.headers.origin ?? event.headers.Origin ?? '';
  if (!origin) {
    return null;
  }

  // Check if origin is in the whitelist
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
};

// Builds CORS headers for responses
export const corsHeaders = (origin: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    Vary: 'Origin',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
};

// Creates a properly formatted JSON response with security headers
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

// Main authorization verification function for backend requests
export const verifyRequest = async (
  event: APIGatewayProxyEvent
): Promise<AuthResult> => {
  const origin = resolveAllowedOrigin(event);

  // Check for Bearer token in Authorization header
  const authHeader = event.headers.authorization ?? event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      response: jsonResponse(401, { error: 'Missing authorization token' }, origin),
    };
  }

  // Verify the shared secret is configured
  if (!JWT_SHARED_SECRET) {
    return {
      ok: false,
      response: jsonResponse(500, { error: 'Server auth not configured' }, origin),
    };
  }

  try {
    const token = authHeader.slice('Bearer '.length).trim();
    const key = textEncoder.encode(JWT_SHARED_SECRET);

    // Verify JWT signature and claims
    const { payload } = await jwtVerify(token, key, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    });

    // Check token scope - must have 'lava:read' to access data
    if (payload.scope !== 'lava:read') {
      return {
        ok: false,
        response: jsonResponse(403, { error: 'Insufficient token scope' }, origin),
      };
    }

    return { ok: true, origin };
  } catch {
    return {
      ok: false,
      response: jsonResponse(401, { error: 'Invalid authorization token' }, origin),
    };
  }
};

// Validates if a string is a valid Cardano address
export const isLikelyCardanoAddress = (address: string): boolean => {
  if (!address || address.length < 20 || address.length > 200) {
    return false;
  }

  try {
    const decoded = deserializeAddress(address);
    return Boolean(decoded.pubKeyHash || decoded.scriptHash);
  } catch {
    return false;
  }
};
