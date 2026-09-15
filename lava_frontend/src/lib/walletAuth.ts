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
  getUsedAddresses?: () => Promise<string[]>;
  signData?: (payload: string, address?: string, convertFromUTF8?: boolean) => Promise<WalletSignature>;
  _walletInstance?: {
    signData?: (address: string, payload: string) => Promise<WalletSignature>;
  };
  walletInstance?: {
    signData?: (address: string, payload: string) => Promise<WalletSignature>;
  };
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
let lastAuthFailureTime = 0;
let lastAuthFailureAddress: string | null = null;
let lastAuthFailureError: Error | null = null;
const AUTH_FAILURE_COOLDOWN_MS = 4_000;

export const clearWalletAuthFailure = () => {
  lastAuthFailureTime = 0;
  lastAuthFailureAddress = null;
  lastAuthFailureError = null;
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

  try {
    return window.localStorage ?? window.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const saveWalletAuthSession = (session: WalletAuthSession) => {
  try {
    getAuthStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('[walletAuth] Failed to save session:', e);
  }
};

export const loadWalletAuthSession = (address?: string): WalletAuthSession | null => {
  try {
    const raw = getAuthStorage()?.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

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
  try {
    getAuthStorage()?.removeItem(AUTH_STORAGE_KEY);
  } catch {}
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

export const signWalletData = async (
  wallet: any,
  address: string,
  message: string
): Promise<WalletSignature> => {
  const messageHex = stringToHex(message);

  // 1. Mesh BrowserWallet: signData(payload, address, convertFromUTF8 = true)
  // When convertFromUTF8 is true, Mesh internally runs fromUTF8(message), converts address to hex, and calls CIP-30 signData
  if (typeof wallet.signData === 'function') {
    try {
      return await wallet.signData(message, address);
    } catch (err1) {
      console.warn('[walletAuth] signData(message, address) failed, trying with hex payload:', err1);
      try {
        return await wallet.signData(messageHex, address, false);
      } catch (err2) {
        console.warn('[walletAuth] signData(messageHex, address, false) failed, trying CIP-30 argument order (address, messageHex):', err2);
        try {
          return await wallet.signData(address, messageHex);
        } catch (err3) {
          const cip30 = wallet._walletInstance ?? wallet.walletInstance;
          if (cip30 && typeof cip30.signData === 'function') {
            console.warn('[walletAuth] Falling back to cip30.signData(address, messageHex)');
            return await cip30.signData(address, messageHex);
          }
          throw err1;
        }
      }
    }
  }

  // 2. Direct CIP-30 instance: signData(address, messageHex)
  const cip30 = wallet._walletInstance ?? wallet.walletInstance;
  if (cip30 && typeof cip30.signData === 'function') {
    return await cip30.signData(address, messageHex);
  }

  throw new Error('Wallet does not support data signing');
};

const authenticateWallet = async (
  wallet: WalletSigner,
  address: string
): Promise<WalletAuthSession> => {
  const challenge = await requestWalletChallenge(address);
  let signature: WalletSignature;

  try {
    signature = await signWalletData(wallet, address, challenge.message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error('[walletAuth] Authentication failed during signature:', error);
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

  if (
    lastAuthFailureAddress === address &&
    lastAuthFailureError &&
    Date.now() - lastAuthFailureTime < AUTH_FAILURE_COOLDOWN_MS
  ) {
    throw lastAuthFailureError;
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
      lastAuthFailureAddress = address;
      lastAuthFailureError = authError;
      lastAuthFailureTime = Date.now();
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
