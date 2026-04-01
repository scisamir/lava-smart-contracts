import {
  applyParamsToScript,
  builtinByteString,
  deserializeDatum,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import { computePoolNftName } from "../data.js";
import { GlobalSettingsHash } from "../global_settings/validator.js";
import { PoolValidatorAddr, PoolValidatorHash } from "../pool/validator.js";
import {
  ATRIUM_POOL_STAKE_ASSET_NAME,
  blockchainProvider,
  blueprint,
  multiSigUtxos,
  NETWORK_ID,
} from "../setup.js";
import { PoolDatumType } from "../types.js";

const RewardsValidator = blueprint.validators.filter((v) =>
  v.title.includes("rewards.rewards_validator.spend"),
);

const predictedAtriumPoolSeedUtxo = multiSigUtxos[0];
const PredictedAtriumPoolNftName = predictedAtriumPoolSeedUtxo
  ? computePoolNftName(
      predictedAtriumPoolSeedUtxo.input.txHash,
      predictedAtriumPoolSeedUtxo.input.outputIndex,
    )
  : null;

const liveAtriumPoolUtxos = await blockchainProvider.fetchAddressUTxOs(
  PoolValidatorAddr,
);

const liveAtriumPools = liveAtriumPoolUtxos.flatMap((utxo) => {
  const poolPlutusData = utxo.output.plutusData;
  if (!poolPlutusData) {
    return [];
  }

  const poolData = deserializeDatum<PoolDatumType>(poolPlutusData);
  if (poolData.fields[6].bytes !== ATRIUM_POOL_STAKE_ASSET_NAME) {
    return [];
  }

  const poolNft = utxo.output.amount.find(
    (asset) =>
      asset.unit.startsWith(PoolValidatorHash) && asset.unit !== "lovelace",
  );

  if (!poolNft) {
    throw new Error("Atrium pool NFT not found on the live Atrium pool UTxO");
  }

  return [{ poolNftName: poolNft.unit.slice(PoolValidatorHash.length) }];
});

if (liveAtriumPools.length === 0) {
  throw new Error(
    "No live Atrium pool UTxO found. rewards/validator.ts now derives the rewards validator from the live pool only.",
  );
}

if (liveAtriumPools.length > 1) {
  throw new Error(
    "Multiple live Atrium pools found. rewards/validator.ts cannot derive a single rewards validator unambiguously.",
  );
}

const [liveAtriumPool] = liveAtriumPools;
const AtriumPoolNftName = liveAtriumPool.poolNftName;
const AtriumPoolNftNameSource = "live";

const RewardsValidatorScript = applyParamsToScript(
  RewardsValidator[0].compiledCode,
  [
    builtinByteString(GlobalSettingsHash),
    builtinByteString(PoolValidatorHash),
    builtinByteString(AtriumPoolNftName),
  ],
  "JSON",
);

const RewardsValidatorHash = resolveScriptHash(RewardsValidatorScript, "V3");

const RewardsValidatorAddr = serializePlutusScript(
  {
    code: RewardsValidatorScript,
    version: "V3",
  },
  undefined,
  NETWORK_ID,
  undefined,
).address;

export {
  AtriumPoolNftName,
  AtriumPoolNftNameSource,
  PredictedAtriumPoolNftName,
  RewardsValidatorScript,
  RewardsValidatorHash,
  RewardsValidatorAddr,
};
