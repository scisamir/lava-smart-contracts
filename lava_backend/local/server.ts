import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as authChallenge } from '../lambda/auth-challenge.js';
import { handler as authVerify } from '../lambda/auth-verify.js';
import { handler as getMarkets } from '../lambda/get-markets.js';
import { handler as getLavaVaults } from '../lambda/get-lava-vaults.js';
import { handler as getUserStBalance } from '../lambda/get-user-st-balance.js';

import { isOriginAllowed } from '../lambda/security.js';

const PORT = Number(process.env.PORT ?? 5050);

const resolveOrigin = (req: IncomingMessage): string | null => {
  const origin = req.headers.origin;
  if (!origin || !isOriginAllowed(origin)) {
    return null;
  }

  return origin;
};

const applyCors = (req: IncomingMessage, res: ServerResponse) => {
  const origin = resolveOrigin(req);

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Vary', 'Origin');

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
};

const send = (res: ServerResponse, result: APIGatewayProxyResult) => {
  res.statusCode = result.statusCode;

  for (const [k, v] of Object.entries(result.headers ?? {})) {
    if (typeof v === 'string') {
      res.setHeader(k, v);
    }
  }

  res.setHeader('Content-Type', 'application/json');
  res.end(result.body ?? '{}');
};

const buildEvent = (req: IncomingMessage, path: string, body: string | null): APIGatewayProxyEvent => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const queryStringParameters: Record<string, string> = {};
  const headers: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    queryStringParameters[key] = value;
  }

  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key] = value;
    }
  }

  return {
    body,
    headers,
    multiValueHeaders: {},
    httpMethod: req.method ?? 'GET',
    isBase64Encoded: false,
    path,
    pathParameters: null,
    queryStringParameters: Object.keys(queryStringParameters).length ? queryStringParameters : null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: path,
  };
};

const readBody = async (req: IncomingMessage): Promise<string | null> => {
  if (req.method !== 'POST') {
    return null;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
};

const route = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const body = await readBody(req);

  if (url.pathname === '/auth/challenge' && req.method === 'POST') {
    const result = await authChallenge(buildEvent(req, '/auth/challenge', body));
    send(res, result);
    return;
  }

  if (url.pathname === '/auth/verify' && req.method === 'POST') {
    const result = await authVerify(buildEvent(req, '/auth/verify', body));
    send(res, result);
    return;
  }

  if (url.pathname === '/markets' && req.method === 'GET') {
    const result = await getMarkets(buildEvent(req, '/markets', null));
    send(res, result);
    return;
  }

  if (url.pathname === '/lava-vaults' && req.method === 'GET') {
    const result = await getLavaVaults(buildEvent(req, '/lava-vaults', null));
    send(res, result);
    return;
  }

  if (url.pathname === '/user-balance' && req.method === 'GET') {
    const result = await getUserStBalance(buildEvent(req, '/user-balance', null));
    send(res, result);
    return;
  }

  res.statusCode = req.method === 'GET' || req.method === 'POST' ? 404 : 405;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      error: 'Not found',
      routes: ['/auth/challenge', '/auth/verify', '/markets', '/lava-vaults', '/user-balance'],
    })
  );
};

createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  });
}).listen(PORT, () => {
  console.log(`Local lava backend listening on http://localhost:${PORT}`);
});
