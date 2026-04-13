// This is the main API route that ensure authentication, rate limiting, and endpoint whitelisting for all backend API calls from the frontend.

import type { NextApiRequest, NextApiResponse } from 'next';
import { createBackendAccessToken } from '@/lib/backendAuth';
import { frontendSessionCookieName, verifyFrontendSessionToken } from '@/lib/sessionAuth';

const ALLOWED_PATHS = new Set(['markets', 'lava-vaults', 'user-balance']);
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Checks IP address from x-forwarded-for header (set by proxy/CDN) before falling back to socket address
const getClientIp = (req: NextApiRequest): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0] ?? req.socket.remoteAddress ?? 'unknown';
  }

  return forwardedFor?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
};

// Checks if a client IP has exceeded the rate limit
const isRateLimited = (clientIp: string): boolean => {
  const now = Date.now();
  const current = rateLimitStore.get(clientIp);

  if (!current || now >= current.resetAt) {
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  rateLimitStore.set(clientIp, current);
  return false;
};

const resolveBackendBaseUrl = (): string => {
  const configured =
    process.env.BACKEND_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    'https://0lth59w8rl.execute-api.us-east-1.amazonaws.com/prod';

  return configured.replace(/\/$/, '').replace(/\/lava-vaults\/?$/, '');
};

// Main API handler that processes requests to proxied backend endpoints
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sessionToken = req.cookies?.[frontendSessionCookieName] ?? '';
  const hasValidSession = await verifyFrontendSessionToken(sessionToken);
  if (!hasValidSession) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const pathParts = req.query.path;
  const path = Array.isArray(pathParts) ? pathParts.join('/') : pathParts ?? '';

  if (!ALLOWED_PATHS.has(path)) {
    res.status(404).json({ error: 'Endpoint not found' });
    return;
  }

  try {
    const token = await createBackendAccessToken();
    const backendBaseUrl = resolveBackendBaseUrl();
    const url = new URL(`${backendBaseUrl}/${path}`);

    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path') {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, item);
        }
      } else if (typeof value === 'string') {
        url.searchParams.append(key, value);
      }
    }

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: req.headers.origin ?? '',
      },
    });

    const bodyText = await upstream.text();
    let json: unknown = {};

    try {
      json = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      json = { error: 'Invalid upstream response' };
    }

    res.status(upstream.status).json(json);
  } catch (error) {
    console.error('Backend proxy failure:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
