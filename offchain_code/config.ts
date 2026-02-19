import { mConStr0, mConStr1, NativeScript, deserializeAddress, serializeNativeScript, resolveNativeScriptHash, mPubKeyAddress } from "@meshsdk/core";

/**
 * LAVA Deployment Configuration for Preprod
 *
 * Run: npx ts-node deploy.ts
 */

// =============================================================================
// ADMIN MULTISIG
// =============================================================================

// Wallet addresses that control the admin multisig
const ADMIN_WALLET_ADDRESSES = [
  "addr_test1qpnwcc6tqp7xv65k4rjt38rzrfkla0ef8yy5378vcprl4u42k0ppan2zzr8qf8dvlat0xkw3k6p8w2llgg4c8245r85qlhf566",
  // Add more for multi-party:
  // "addr_test1qp...",
];

// Extract pubKeyHashes from addresses
const ADMIN_KEY_HASHES = ADMIN_WALLET_ADDRESSES.map(addr =>
  deserializeAddress(addr).pubKeyHash
);

// Native script: "all" = all must sign, "any" = any one, "atLeast" = n of m
const ADMIN_NATIVE_SCRIPT: NativeScript = {
  type: "all",
  scripts: ADMIN_KEY_HASHES.map(keyHash => ({
    type: "sig",
    keyHash: keyHash,
  })),
};

const { address: ADMIN_SCRIPT_ADDRESS, scriptCbor: ADMIN_SCRIPT_CBOR } =
  serializeNativeScript(ADMIN_NATIVE_SCRIPT);
const ADMIN_SCRIPT_HASH = resolveNativeScriptHash(ADMIN_NATIVE_SCRIPT);

export const ADMIN_CONFIG = {
  walletAddresses: ADMIN_WALLET_ADDRESSES,
  keyHashes: ADMIN_KEY_HASHES,
  nativeScript: ADMIN_NATIVE_SCRIPT,
  scriptAddress: ADMIN_SCRIPT_ADDRESS,
  scriptCbor: ADMIN_SCRIPT_CBOR,
  scriptHash: ADMIN_SCRIPT_HASH,
};

console.log("Admin Multisig Address:", ADMIN_SCRIPT_ADDRESS);
console.log("Admin Script Hash:", ADMIN_SCRIPT_HASH);

// =============================================================================
// DEPLOYMENT CONFIG
// =============================================================================

export const CONFIG = {
  // Admin script hash (derived from multisig above)
  adminScHash: ADMIN_SCRIPT_HASH,

  // GlobalSettings NFT token name
  gsNftName: "GSN",

  // Minimum ADA for UTxOs (lovelace)
  minUtxoAda: 5_000_000,

  // Submit transaction after building
  submitTx: true,

  // =============================================================================
  // GLOBAL SETTINGS DATUM FIELDS
  // =============================================================================

  globalSettingsDatum: {
    // Authorized batcher pubkey hashes (hex, 28 bytes)
    authorizedBatchers: [
      "66ec634b007c666a96a8e4b89c621a6dfebf29390948f8ecc047faf2",
    ],

    // Minimum lovelace required for pool UTxOs
    minPoolLovelace: 5_000_000,
  },
};

// =============================================================================
// DATUM BUILDER HELPERS
// =============================================================================

/**
 * Builds authorized batchers list as SignerType
 * SignerType:
 *   VerificationKeySigner = Constr0 [pubKeyHash]
 *   SpendScriptSigner = Constr1 [scriptHash]
 *   WithdrawScriptSigner = Constr2 [scriptHash]
 *   MintScriptSigner = Constr3 [scriptHash]
 *
 * For pubkey batchers, use VerificationKeySigner (Constr0)
 */
export function buildAuthorizedBatchers(batchers: string[]) {
  // VerificationKeySigner = Constr0 [pubKeyHash]
  return batchers.map(pkh => mConStr0([pkh]));
}

/**
 * Builds an AssetType datum
 * AssetType = Constr0 [isStable, policyId, assetName, multiplier]
 * Bool: True = Constr1 [], False = Constr0 []
 */
export function buildAssetType(
  isStable: boolean,
  policyId: string,
  assetName: string,
  multiplier: bigint
) {
  return mConStr0([
    isStable ? mConStr1([]) : mConStr0([]),
    policyId,
    assetName,
    multiplier,
  ]);
}

/**
 * Builds a ReceiptTokens datum for staking
 * ReceiptTokens = Constr0 [assetType, poolStakeAssetName, stakeAddress, datumVerifier]
 * Option<T>: Some(x) = Constr0 [x], None = Constr1 []
 */
export function buildReceiptTokens(
  assetType: ReturnType<typeof buildAssetType>,
  poolStakeAssetName: string,
  stakeAddress: string | null,
  datumVerifierHash: string | null
) {
  return mConStr0([
    assetType,
    poolStakeAssetName,
    stakeAddress ? mConStr0([mPubKeyAddress(stakeAddress)]) : mConStr1([]),
    datumVerifierHash ? mConStr0([datumVerifierHash]) : mConStr1([]),
  ]);
}
