import {
  applyCborEncoding,
  applyParamsToScript,
  Asset,
  BlockfrostProvider,
  builtinByteString,
  conStr,
  MeshTxBuilder,
  MeshWallet,
  outputReference,
  resolveScriptHash,
  serializePlutusScript,
  serializeRewardAddress,
  stringToHex,
  type UTxO,
} from "@meshsdk/core";
import blueprint from "../../generated/plutus.json" with { type: "json" };
import { CONFIG as ATRIUM_CONFIG } from "../../generated/atrium_mainnet/config";

export type SupportedProvider = BlockfrostProvider;

export const NETWORK = (
  process.env.NEXT_PUBLIC_CARDANO_NETWORK ?? "mainnet"
).toLowerCase() as "mainnet" | "preprod";
export const NETWORK_ID: 0 | 1 = NETWORK === "preprod" ? 0 : 1;
export const MESH_NETWORK = NETWORK_ID === 1 ? "mainnet" : "preprod";
export const GS_PARAM_TX_HASH =
  "9d225cd31ee8b47b9782a2b1a9308a02d129f919e562dd492d4accb5b25311ab";
export const GS_PARAM_TX_IDX = 4;
export const BATCHING_SCRIPT_TX_HASH =
  "f268168603dc31abf523acabb72b8c47662a9e33efd5a44f7f1f6f4358ef247d";
export const BATCHING_SCRIPT_TX_IDX = 0;
export const POOL_SCRIPT_TX_HASH =
  "6dd8752d81233d08afe8193116c051eed24b83d5b3747f1eac3511dba4e1b3d8";
export const POOL_SCRIPT_TX_IDX = 0;
export const MIN_POOL_LOVELACE = 5_000_000n;
export const PRECISION_FACTOR = 100_000n;
export const REWARD_OUTPUT_LOVELACE = 2_500_000n;
export const MIN_ATRIUM_STAKE_POOL_LOVELACE = 2_000_000n;
export const ATRIUM_POOL_STAKE_ASSET_NAME = stringToHex("LADA");

const requireValidatorCode = (title: string) => {
  const validator = (
    blueprint as { validators: Array<{ title: string; compiledCode: string }> }
  ).validators.find((item) => item.title === title);

  if (!validator) {
    throw new Error(`Validator not found in blueprint: ${title}`);
  }

  return validator.compiledCode;
};

const serializeSelfStakedValidatorAddress = (
  script: string,
  scriptHash: string,
) =>
  serializePlutusScript(
    { code: script, version: "V3" },
    scriptHash,
    NETWORK_ID,
    true,
  ).address;

export const GlobalSettingsValidatorScript = applyParamsToScript(
  requireValidatorCode("global_settings.global_settings.spend"),
  [outputReference(GS_PARAM_TX_HASH, GS_PARAM_TX_IDX)],
  "JSON",
);
export const GlobalSettingsHash = resolveScriptHash(
  GlobalSettingsValidatorScript,
  "V3",
);
export const GlobalSettingsAddr = serializePlutusScript(
  { code: GlobalSettingsValidatorScript, version: "V3" },
  undefined,
  NETWORK_ID,
  undefined,
).address;

export const PoolValidatorScript = applyParamsToScript(
  requireValidatorCode("pool.pool_validator.mint"),
  [builtinByteString(GlobalSettingsHash)],
  "JSON",
);
export const PoolValidatorHash = resolveScriptHash(PoolValidatorScript, "V3");
export const PoolValidatorAddr = serializeSelfStakedValidatorAddress(
  PoolValidatorScript,
  PoolValidatorHash,
);

export const BatchingValidatorScript = applyParamsToScript(
  requireValidatorCode("pool_batching.pool_batching.withdraw"),
  [builtinByteString(GlobalSettingsHash), builtinByteString(PoolValidatorHash)],
  "JSON",
);
export const BatchingHash = resolveScriptHash(BatchingValidatorScript, "V3");
export const BatchingRewardAddress = serializeRewardAddress(
  BatchingHash,
  true,
  NETWORK_ID,
);
export const BATCHING_HASH = BatchingHash;
export const BATCHING_REWARD_ADDRESS = BatchingRewardAddress;

export const OrderValidatorScript = applyParamsToScript(
  requireValidatorCode("order.order_validator.spend"),
  [
    builtinByteString(GlobalSettingsHash),
    conStr(1, [builtinByteString(BatchingHash)]),
  ],
  "JSON",
);
export const OrderValidatorHash = resolveScriptHash(OrderValidatorScript, "V3");
export const OrderValidatorAddr = serializeSelfStakedValidatorAddress(
  OrderValidatorScript,
  OrderValidatorHash,
);

export const MintingValidatorScript = applyParamsToScript(
  requireValidatorCode("minting.minting.mint"),
  [
    conStr(1, [builtinByteString(BatchingHash)]),
    builtinByteString(GlobalSettingsHash),
  ],
  "JSON",
);
export const MintingHash = resolveScriptHash(MintingValidatorScript, "V3");

export const StakeValidatorScript = applyParamsToScript(
  requireValidatorCode("stake.stake_validator.withdraw"),
  [builtinByteString(GlobalSettingsHash), builtinByteString(PoolValidatorHash)],
  "JSON",
);
export const StakeValidatorHash = resolveScriptHash(StakeValidatorScript, "V3");
export const StakeRewardAddress = serializeRewardAddress(
  StakeValidatorHash,
  true,
  NETWORK_ID,
);

export const resolveBlockfrostProjectId = () => {
  if (NETWORK !== "mainnet") {
    throw new Error(
      "The latest e2e testing frontend currently targets mainnet only.",
    );
  }

  const blockfrostId =
    process.env.NEXT_PUBLIC_BLOCKFROST_ID ??
    process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY ??
    ATRIUM_CONFIG.blockfrostApiKey;

  if (blockfrostId) {
    return blockfrostId;
  }

  throw new Error(
    "Set NEXT_PUBLIC_BLOCKFROST_ID before using the testing frontend.",
  );
};

type BlockfrostScriptCborResponse = {
  cbor?: unknown;
};

type PlutusV3ScriptArtifacts = {
  rewardAddress: string;
  script: string;
  scriptHash: string;
};

const plutusV3ScriptCache = new Map<string, Promise<PlutusV3ScriptArtifacts>>();

const fetchBlockfrostJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`https://cardano-mainnet.blockfrost.io/api/v0${path}`, {
    headers: {
      project_id: resolveBlockfrostProjectId(),
    },
  });

  if (!response.ok) {
    throw new Error(`Blockfrost ${response.status} while fetching ${path}.`);
  }

  return (await response.json()) as T;
};

export const fetchPlutusV3ScriptArtifactsByHash = async (
  scriptHash: string,
): Promise<PlutusV3ScriptArtifacts> => {
  const cached = plutusV3ScriptCache.get(scriptHash);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const scriptResponse = await fetchBlockfrostJson<BlockfrostScriptCborResponse>(
      `/scripts/${scriptHash}/cbor`,
    );
    if (typeof scriptResponse.cbor !== "string" || scriptResponse.cbor.length === 0) {
      throw new Error(
        `Blockfrost returned an empty script payload for ${scriptHash}.`,
      );
    }

    const script = applyCborEncoding(scriptResponse.cbor);
    const resolvedHash = resolveScriptHash(script, "V3");

    if (resolvedHash !== scriptHash) {
      throw new Error(
        `Blockfrost returned a verifier script that hashes to ${resolvedHash} instead of ${scriptHash}.`,
      );
    }

    return {
      rewardAddress: serializeRewardAddress(scriptHash, true, NETWORK_ID),
      script,
      scriptHash,
    };
  })();

  plutusV3ScriptCache.set(scriptHash, pending);

  try {
    return await pending;
  } catch (error) {
    plutusV3ScriptCache.delete(scriptHash);
    throw error;
  }
};

export const createTestingProvider = (): SupportedProvider => {
  return new BlockfrostProvider(resolveBlockfrostProjectId());
};

export const createTxBuilder = (provider: SupportedProvider) => {
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
    evaluator: provider,
    verbose: false,
  });

  txBuilder.setNetwork(MESH_NETWORK);

  return txBuilder;
};

const MIN_COLLATERAL_LOVELACE = 5_000_000n;

export const pickCollateralUtxo = (walletUtxos: UTxO[]) => {
  const candidates = [...walletUtxos].sort((left, right) => {
    const leftLovelace = BigInt(
      left.output.amount.find((asset: Asset) => asset.unit === "lovelace")
        ?.quantity ?? "0",
    );
    const rightLovelace = BigInt(
      right.output.amount.find((asset: Asset) => asset.unit === "lovelace")
        ?.quantity ?? "0",
    );

    return rightLovelace > leftLovelace ? 1 : -1;
  });

  const collateral = candidates.find(
    (utxo) =>
      utxo.output.amount.length === 1 &&
      BigInt(
        utxo.output.amount.find((asset: Asset) => asset.unit === "lovelace")
          ?.quantity ?? "0",
      ) >= MIN_COLLATERAL_LOVELACE,
  );

  if (!collateral) {
    throw new Error(
      "No pure-ADA collateral UTxO found with at least 5 ADA. Keep a separate ADA-only UTxO in the wallet for testing.",
    );
  }

  return collateral;
};

export const createBatchingWallet = (provider: SupportedProvider) => {
  const mnemonic =
    process.env.NEXT_PUBLIC_BATCHER_WALLET_MNEMONIC ??
    process.env.NEXT_PUBLIC_WALLET_PASSPHRASE_ONE;

  if (!mnemonic) {
    throw new Error(
      "Set NEXT_PUBLIC_BATCHER_WALLET_MNEMONIC (or NEXT_PUBLIC_WALLET_PASSPHRASE_ONE) to batch from the browser.",
    );
  }

  return new MeshWallet({
    networkId: NETWORK_ID,
    fetcher: provider,
    submitter: provider,
    key: {
      type: "mnemonic",
      words: mnemonic.trim().split(/\s+/),
    },
  });
};
