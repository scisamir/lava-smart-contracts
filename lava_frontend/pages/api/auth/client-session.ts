import type { NextApiRequest, NextApiResponse } from 'next';
import { frontendSessionCookieName, issueFrontendSessionToken } from '@/lib/sessionAuth';

const oneDay = 24 * 60 * 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : (forwardedFor?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown');

    const token = await issueFrontendSessionToken(clientIp);
    const isProd = process.env.NODE_ENV === 'production';

    res.setHeader(
      'Set-Cookie',
      `${frontendSessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${oneDay}; ${
        isProd ? 'Secure;' : ''
      }`
    );

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to issue client session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
