import { BlockfrostProvider, MeshTxBuilder, castProtocol } from "@meshsdk/core";
import { LAVA_NETWORK, NETWORK_CONFIG } from "./network.js";

const blockfrostId = process.env.BLOCKFROST_ID?.trim();
if (!blockfrostId) {
  throw new Error("BLOCKFROST_ID does not exist");
}
if (!blockfrostId.startsWith(LAVA_NETWORK)) {
  throw new Error(`BLOCKFROST_ID does not match LAVA_NETWORK=${LAVA_NETWORK}`);
}

const blockchainProvider = new BlockfrostProvider(blockfrostId);
const response = await fetch(
  `${NETWORK_CONFIG.blockfrostBaseUrl}/epochs/latest/parameters`,
  { headers: { project_id: blockfrostId } },
);
if (!response.ok) {
  throw new Error(`Failed to fetch Blockfrost protocol parameters: ${response.status}`);
}

const parameters = await response.json();
const protocolParameters = castProtocol({
  coinsPerUtxoSize: parameters.coins_per_utxo_word,
  collateralPercent: parameters.collateral_percent,
  decentralisation: parameters.decentralisation_param,
  epoch: parameters.epoch,
  keyDeposit: parameters.key_deposit,
  maxBlockExMem: parameters.max_block_ex_mem,
  maxBlockExSteps: parameters.max_block_ex_steps,
  maxBlockHeaderSize: parameters.max_block_header_size,
  maxBlockSize: parameters.max_block_size,
  maxCollateralInputs: parameters.max_collateral_inputs,
  maxTxExMem: parameters.max_tx_ex_mem,
  maxTxExSteps: parameters.max_tx_ex_steps,
  maxTxSize: parameters.max_tx_size,
  maxValSize: parameters.max_val_size,
  minFeeA: parameters.min_fee_a,
  minFeeB: parameters.min_fee_b,
  minPoolCost: parameters.min_pool_cost,
  poolDeposit: parameters.pool_deposit,
  priceMem: parameters.price_mem,
  priceStep: parameters.price_step,
});
const costModels = [
  parameters.cost_models_raw?.PlutusV1,
  parameters.cost_models_raw?.PlutusV2,
  parameters.cost_models_raw?.PlutusV3,
];

if (
  costModels.length !== 3 ||
  costModels.some((model) => !Array.isArray(model) || model.length === 0)
) {
  throw new Error("Blockfrost returned incomplete cost models");
}

const txBuilder = new MeshTxBuilder({
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
  evaluator: blockchainProvider,
  params: protocolParameters,
  verbose: false,
});
txBuilder.setCostModels(costModels);

export { blockchainProvider, txBuilder };
