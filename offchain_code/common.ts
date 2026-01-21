import fs from "node:fs";
import {
  BlockfrostProvider,
  MeshTxBuilder,
  MeshWallet,
  serializePlutusScript,
  UTxO,
  MaestroProvider,
  resolveScriptHash,
  serializeRewardAddress,
  PlutusScript,
  applyCborEncoding
} from "@meshsdk/core";
import { applyParamsToScript } from "@meshsdk/core-csl";
import { OfflineEvaluator } from "@meshsdk/core-csl";

// Import the plutus.json blueprint
import blueprint from "../smart_contract/plutus.json";

// Network configuration
const NETWORK = "preprod";
const NETWORK_ID = 0; // 0 = testnet, 1 = mainnet

// Setup Blockfrost provider - UPDATE WITH YOUR API KEY
export const blockchainProvider = new BlockfrostProvider("YOUR_BLOCKFROST_API_KEY");

const tester = new OfflineEvaluator(blockchainProvider, NETWORK);

// Setup Maestro (optional) - UPDATE WITH YOUR API KEY
export const maestroProvider = new MaestroProvider({
  network: 'Preprod',
  apiKey: 'YOUR_MAESTRO_API_KEY',
  turboSubmit: false,
});

// Wallet for signing transactions - UPDATE WITH YOUR WALLET KEY
// Option 1: Using a root key (bech32 format)
// Option 2: Using a mnemonic phrase
export const wallet = new MeshWallet({
  networkId: NETWORK_ID,
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
  key: {
    type: "root",
    bech32: "YOUR_WALLET_BECH32_KEY", // Replace with your wallet key or use environment variable
  },
});

// Reusable function to get a transaction builder
export function getTxBuilder() {
  return new MeshTxBuilder({
    fetcher: blockchainProvider,
    evaluator: blockchainProvider,
    submitter: blockchainProvider,
    verbose: true
  });
}

// Reusable function to get a UTxO by transaction hash
export async function getUtxoByTxHash(txHash: string): Promise<UTxO> {
  const utxos = await blockchainProvider.fetchUTxOs(txHash);
  if (utxos.length === 0) {
    throw new Error("UTxO not found");
  }
  return utxos[0];
}

// =============================================================================
// LAVA CONTRACT FUNCTIONS
// =============================================================================

// Validator indices from plutus.json
export const VALIDATORS = {
  GLOBAL_SETTINGS_SPEND: 0,
  GLOBAL_SETTINGS_MINT: 1,
  GLOBAL_SETTINGS_ELSE: 2,
  MINTING_MINT: 3,
  MINTING_ELSE: 4,
  ORDER_MINT: 5,
  ORDER_SPEND: 6,
  ORDER_ELSE: 7,
  PLACEHOLDER_MINT: 8,
  PLACEHOLDER_ELSE: 9,
  POOL_MINT: 10,
  POOL_SPEND: 11,
  POOL_WITHDRAW: 12,
  POOL_PUBLISH: 13,
  POOL_ELSE: 14,
  POOL_BATCHING_WITHDRAW: 15,
  POOL_BATCHING_ELSE: 16,
  REWARDS_SPEND: 17,
  REWARDS_ELSE: 18,
  STAKE_WITHDRAW: 19,
  STAKE_ELSE: 20,
  ATRIUM_WITHDRAW: 21,
  ATRIUM_ELSE: 22,
  IAG_WITHDRAW: 23,
  IAG_ELSE: 24,
  STRIKE_WITHDRAW: 25,
  STRIKE_ELSE: 26,
  MINSWAP_SWAP_WITHDRAW: 27,
  MINSWAP_SWAP_ELSE: 28,
};

/**
 * Get GlobalSettings validator (spend/mint)
 * Parameters: utxo_ref (OutputReference)
 */
export function getGlobalSettings(utxoRef: { txHash: string; index: number }) {
  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.GLOBAL_SETTINGS_SPEND].compiledCode,
    [
      {
        alternative: 0,
        fields: [utxoRef.txHash, utxoRef.index]
      }
    ],
    "Mesh"
  );

  const scriptAddr = serializePlutusScript(
    { code: scriptCbor, version: "V3" },
    undefined,
    NETWORK_ID
  ).address;

  const policyId = resolveScriptHash(scriptCbor, "V3");

  return { scriptCbor, scriptAddr, policyId };
}

/**
 * Get Minting validator
 * Parameters: pool_batching_cred (Credential), gs_validator_hash (ScriptHash)
 */
export function getMinting(poolBatchingCred: string, gsValidatorHash: string) {
  // Credential = Script(hash) = Constr1 [hash]
  const poolBatchingCredential = {
    alternative: 1,
    fields: [poolBatchingCred]
  };

  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.MINTING_MINT].compiledCode,
    [poolBatchingCredential, gsValidatorHash],
    "Mesh"
  );

  const policyId = resolveScriptHash(scriptCbor, "V3");

  return { scriptCbor, policyId };
}

/**
 * Get Order validator
 * Parameters: gs_validator_hash (ScriptHash), pool_batching_cred (Credential)
 */
export function getOrder(gsValidatorHash: string, poolBatchingCred: string) {
  // Credential = Script(hash) = Constr1 [hash]
  const poolBatchingCredential = {
    alternative: 1,
    fields: [poolBatchingCred]
  };

  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.ORDER_SPEND].compiledCode,
    [gsValidatorHash, poolBatchingCredential],
    "Mesh"
  );

  const scriptAddr = serializePlutusScript(
    { code: scriptCbor, version: "V3" },
    undefined,
    NETWORK_ID
  ).address;

  const scriptHash = resolveScriptHash(scriptCbor, "V3");

  return { scriptCbor, scriptAddr, scriptHash };
}

/**
 * Get Placeholder validator (no parameters)
 */
export function getPlaceholder() {
  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.PLACEHOLDER_MINT].compiledCode,
    []
  );

  const policyId = resolveScriptHash(scriptCbor, "V3");

  return { scriptCbor, policyId };
}

/**
 * Get Pool validator
 * Parameters: gs_validator_hash (ScriptHash)
 */
export function getPool(gsValidatorHash: string) {
  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.POOL_SPEND].compiledCode,
    [gsValidatorHash],
    "Mesh"
  );

  const scriptAddr = serializePlutusScript(
    { code: scriptCbor, version: "V3" },
    undefined,
    NETWORK_ID
  ).address;

  const scriptHash = resolveScriptHash(scriptCbor, "V3");

  return { scriptCbor, scriptAddr, scriptHash };
}

/**
 * Get PoolBatching validator
 * Parameters: gs_validator_hash (ScriptHash), pool_validator_hash (ScriptHash)
 */
export function getPoolBatching(gsValidatorHash: string, poolValidatorHash: string) {
  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.POOL_BATCHING_WITHDRAW].compiledCode,
    [gsValidatorHash, poolValidatorHash],
    "Mesh"
  );

  const scriptHash = resolveScriptHash(scriptCbor, "V3");

  const rewardAddress = serializeRewardAddress(
    scriptHash,
    true,
    NETWORK_ID
  );

  return { scriptCbor, scriptHash, rewardAddress };
}

/**
 * Get Rewards validator
 * Parameters: gs_validator_hash (ScriptHash), pool_validator_hash (ScriptHash)
 */
export function getRewards(gsValidatorHash: string, poolValidatorHash: string) {
  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.REWARDS_SPEND].compiledCode,
    [gsValidatorHash, poolValidatorHash],
    "Mesh"
  );

  const scriptAddr = serializePlutusScript(
    { code: scriptCbor, version: "V3" },
    undefined,
    NETWORK_ID
  ).address;

  const scriptHash = resolveScriptHash(scriptCbor, "V3");

  return { scriptCbor, scriptAddr, scriptHash };
}

/**
 * Get Stake validator
 * Parameters: gs_validator_hash (ScriptHash), pool_validator_hash (ScriptHash)
 */
export function getStake(gsValidatorHash: string, poolValidatorHash: string) {
  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.STAKE_WITHDRAW].compiledCode,
    [gsValidatorHash, poolValidatorHash],
    "Mesh"
  );

  const scriptHash = resolveScriptHash(scriptCbor, "V3");

  const rewardAddress = serializeRewardAddress(
    scriptHash,
    true,
    NETWORK_ID
  );

  return { scriptCbor, scriptHash, rewardAddress };
}

/**
 * Get Strike stake validator
 * Parameters: gs_validator_hash (ScriptHash)
 */
export function getStrike(gsValidatorHash: string) {
  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.STRIKE_WITHDRAW].compiledCode,
    [gsValidatorHash],
    "Mesh"
  );

  const scriptHash = resolveScriptHash(scriptCbor, "V3");

  const rewardAddress = serializeRewardAddress(
    scriptHash,
    true,
    NETWORK_ID
  );

  return { scriptCbor, scriptHash, rewardAddress };
}

/**
 * Get MinswapSwap validator
 * Parameters: minswap_order_validator_hash (ScriptHash), rewards_address (Address)
 */
export function getMinswapSwap(minswapOrderValidatorHash: string, rewardsAddress: string) {
  const scriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.MINSWAP_SWAP_WITHDRAW].compiledCode,
    [minswapOrderValidatorHash, rewardsAddress],
    "Mesh"
  );

  const scriptHash = resolveScriptHash(scriptCbor, "V3");

  const rewardAddress = serializeRewardAddress(
    scriptHash,
    true,
    NETWORK_ID
  );

  return { scriptCbor, scriptHash, rewardAddress };
}

// Export blueprint for direct access
export { blueprint };
export { NETWORK, NETWORK_ID };
