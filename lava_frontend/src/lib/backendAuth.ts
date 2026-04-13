// This module creates short-lived JWT tokens that the frontend uses to
// authenticate requests to backend Lambda functions. These tokens are created
// on-the-fly for each request and have a 2-minute expiration.

// The frontend acts as a trusted proxy, creating tokens that prove:
// 1. The request came from an authenticated frontend session
// 2. The frontend has the 'lava:read' scope for accessing resources

import { SignJWT } from 'jose';

const JWT_ISSUER = process.env.JWT_ISSUER ?? 'lava-frontend';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'lava-backend';

// Retrieves the shared secret used to sign backend tokens
const getJwtSecret = (): string => {
  const secret = process.env.BACKEND_JWT_SHARED_SECRET;
  if (!secret) {
    throw new Error('BACKEND_JWT_SHARED_SECRET is not configured');
  }

  return secret;
};

// Creates a short-lived JWT token for authenticating to the backend as proof that the frontend has permission to read backend resources
export const createBackendAccessToken = async (): Promise<string> => {
  const secret = getJwtSecret();
  const key = new TextEncoder().encode(secret);

  return new SignJWT({ scope: 'lava:read' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(key);
};
