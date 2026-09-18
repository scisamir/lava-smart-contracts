const DEFAULT_BACKEND_URL = 'https://tk3y4kw3f6.execute-api.us-east-1.amazonaws.com/prod';

const normalizePath = (path: string): string => (path.startsWith('/') ? path : `/${path}`);

export const getBackendBaseUrl = (): string => {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (!configured || configured.includes('0lth59w8rl') || configured.includes('localhost:5050')) {
    return DEFAULT_BACKEND_URL;
  }
  return configured.replace(/\/$/, '');
};

type BackendFetchOptions = RequestInit & {
  token?: string;
};

export const fetchBackend = async (
  path: string,
  { token, headers, ...init }: BackendFetchOptions = {}
): Promise<Response> => {
  const requestHeaders = new Headers(headers);

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const url = `${getBackendBaseUrl()}${normalizePath(path)}`;
  return fetch(url, {
    ...init,
    headers: requestHeaders,
  });
};