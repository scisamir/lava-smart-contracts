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
if (!predictedAtriumPoolSeedUtxo) {
  throw new Error("No multisig UTxO available to derive the Atrium pool NFT");
}

const PredictedAtriumPoolNftName = computePoolNftName(
  predictedAtriumPoolSeedUtxo.input.txHash,
  predictedAtriumPoolSeedUtxo.input.outputIndex,
);

const liveAtriumPoolUtxos = await blockchainProvider.fetchAddressUTxOs(
  PoolValidatorAddr,
);

const liveAtriumPool = liveAtriumPoolUtxos.flatMap((utxo) => {
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
})[0];

const AtriumPoolNftName = liveAtriumPool?.poolNftName ?? PredictedAtriumPoolNftName;
const AtriumPoolNftNameSource = liveAtriumPool ? "live" : "predicted";

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
