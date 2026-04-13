// This module manages JWT tokens for frontend user sessions.

import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'lava_session';
const SESSION_ISSUER = 'lava-frontend-session';
const SESSION_AUDIENCE = 'lava-frontend-api';

// Retrieves the secret key used to sign and verify session tokens
const getSessionSecret = (): string => {
  const secret = process.env.FRONTEND_SESSION_SECRET;
  if (!secret) {
    throw new Error('FRONTEND_SESSION_SECRET is not configured');
  }

  return secret;
};

const getSessionKey = (): Uint8Array => {
  return new TextEncoder().encode(getSessionSecret());
};

// Creates a signed JWT session token for a user when a user successfully authenticates via wallet
export const issueFrontendSessionToken = async (subject: string): Promise<string> => {
  const key = getSessionKey();

  return new SignJWT({ role: 'client' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(key);
};

// Verifies the validity of a frontend session token
export const verifyFrontendSessionToken = async (token: string): Promise<boolean> => {
  try {
    const key = getSessionKey();
    const { payload } = await jwtVerify(token, key, {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      algorithms: ['HS256'],
    });

    // Ensure the token has the 'client' role
    return payload.role === 'client';
  } catch {
    return false;
  }
};

export const frontendSessionCookieName = SESSION_COOKIE_NAME;
