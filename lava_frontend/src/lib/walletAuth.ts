import { stringToHex } from '@meshsdk/core';
import { fetchBackend } from '@/lib/backendClient';
import { networkConfig } from '@/lib/networkConfig';

type WalletSignature = {
  key: string;
  signature: string;
};

export type WalletSigner = {
  getNetworkId: () => Promise<number>;
  getChangeAddress: () => Promise<string>;
  signData: (address: string, payload: string) => Promise<WalletSignature>;
};

const assertWalletNetwork = async (wallet: WalletSigner): Promise<void> => {
  let walletNetworkId: number;

  try {
    walletNetworkId = await wallet.getNetworkId();
  } catch {
    throw new Error('Unable to verify wallet network. Please try again.');
  }

  if (walletNetworkId !== networkConfig.networkId) {
    throw new Error(`Switch your wallet to ${networkConfig.label}`);
  }
};

type WalletChallengeResponse = {
  challengeToken: string;
  message: string;
  expiresAt: string;
};

export type WalletAuthSession = {
  address: string;
  token: string;
  expiresAt: string;
};

const AUTH_STORAGE_KEY = `lavaWalletAuth:${networkConfig.name}`;

let inFlightAddress: string | null = null;
let inFlightAuth: Promise<WalletAuthSession> | null = null;
let failedAuthAddress: string | null = null;
let failedAuthError: Error | null = null;

const clearWalletAuthFailure = () => {
  failedAuthAddress = null;
  failedAuthError = null;
};

const isSessionValid = (session: WalletAuthSession | null, address?: string): session is WalletAuthSession => {
  if (!session?.token || !session.address || !session.expiresAt) {
    return false;
  }

  if (address && session.address !== address) {
    return false;
  }

  return new Date(session.expiresAt).getTime() > Date.now() + 30_000;
};

const getAuthStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
};

const saveWalletAuthSession = (session: WalletAuthSession) => {
  getAuthStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const loadWalletAuthSession = (address?: string): WalletAuthSession | null => {
  const raw = getAuthStorage()?.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as WalletAuthSession;
    if (!isSessionValid(parsed, address)) {
      getAuthStorage()?.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    getAuthStorage()?.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const clearWalletAuthSession = () => {
  getAuthStorage()?.removeItem(AUTH_STORAGE_KEY);
  clearWalletAuthFailure();
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = (await response.json()) as T;
  return data;
};

const getErrorBody = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return '';
  }
};

const requestWalletChallenge = async (address: string): Promise<WalletChallengeResponse> => {
  const response = await fetchBackend('/auth/challenge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address }),
  });

  if (!response.ok) {
    const body = await getErrorBody(response);
    throw new Error(
      `Failed to create auth challenge: ${response.status}${body ? ` ${body}` : ''}`
    );
  }

  return parseJson<WalletChallengeResponse>(response);
};

const verifyWalletChallenge = async (
  address: string,
  challengeToken: string,
  signature: WalletSignature
): Promise<WalletAuthSession> => {
  const response = await fetchBackend('/auth/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address,
      challengeToken,
      signature,
    }),
  });

  if (!response.ok) {
    const body = await getErrorBody(response);
    throw new Error(
      `Failed to verify wallet challenge: ${response.status}${body ? ` ${body}` : ''}`
    );
  }

  return parseJson<WalletAuthSession>(response);
};

const authenticateWallet = async (
  wallet: WalletSigner,
  address: string
): Promise<WalletAuthSession> => {
  const challenge = await requestWalletChallenge(address);
  let signature: WalletSignature;

  try {
    const signerAddress = await wallet.getChangeAddress();
    signature = await wallet.signData(signerAddress, stringToHex(challenge.message));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Wallet signature failed: ${reason || 'unknown error'}`);
  }

  const session = await verifyWalletChallenge(address, challenge.challengeToken, signature);

  saveWalletAuthSession(session);
  return session;
};

export const ensureWalletAuthSession = async (
  wallet: WalletSigner,
  address: string
): Promise<WalletAuthSession> => {
  await assertWalletNetwork(wallet);

  const stored = loadWalletAuthSession(address);
  if (stored) {
    return stored;
  }

  if (failedAuthAddress === address && failedAuthError) {
    throw failedAuthError;
  }

  if (inFlightAuth && inFlightAddress === address) {
    return inFlightAuth;
  }

  inFlightAddress = address;
  inFlightAuth = authenticateWallet(wallet, address)
    .then((session) => {
      clearWalletAuthFailure();
      return session;
    })
    .catch((error: unknown) => {
      const authError = error instanceof Error ? error : new Error(String(error));
      failedAuthAddress = address;
      failedAuthError = authError;
      throw authError;
    });

  try {
    return await inFlightAuth;
  } finally {
    if (inFlightAddress === address) {
      inFlightAddress = null;
      inFlightAuth = null;
    }
  }
};

export const retryWalletAuthSession = async (
  wallet: WalletSigner,
  address: string
): Promise<WalletAuthSession> => {
  clearWalletAuthFailure();
  return ensureWalletAuthSession(wallet, address);
};
