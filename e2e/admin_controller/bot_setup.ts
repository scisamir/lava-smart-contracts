import {
  MeshWallet,
  UTxO,
  deserializeAddress,
} from "@meshsdk/core";
import { NETWORK_CONFIG, NETWORK_ID } from "../network.js";
import { blockchainProvider, txBuilder } from "../provider.js";

const botPassphrase = process.env.BOT_WALLET_PASSPHRASE?.trim();
if (!botPassphrase) {
  throw new Error("BOT_WALLET_PASSPHRASE does not exist");
}

const botWallet = new MeshWallet({
  networkId: NETWORK_ID,
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
  key: {
    type: "mnemonic",
    words: botPassphrase.split(" "),
  },
});

const botAddress = await botWallet.getChangeAddress();
const botUtxos = await botWallet.getUtxos();
const { pubKeyHash: botKeyHash } = deserializeAddress(botAddress);

if (
  NETWORK_CONFIG.adminController.poolToggler.type !== "verificationKey" ||
  botKeyHash !== NETWORK_CONFIG.adminController.poolToggler.hash
) {
  throw new Error(
    "Bot wallet does not match config/lava-networks.json",
  );
}

const minimumCollateral = 8_000_000n;

const getLovelace = (utxo: UTxO): bigint =>
  BigInt(
    utxo.output.amount.find((asset) => asset.unit === "lovelace")?.quantity ??
      "0",
  );

const isPureAda = (utxo: UTxO): boolean =>
  utxo.output.amount.length === 1 &&
  utxo.output.amount[0]?.unit === "lovelace";

const eligibleCollateral = botUtxos.filter(
  (utxo) => getLovelace(utxo) >= minimumCollateral,
);
const collateralCandidates = eligibleCollateral.some(isPureAda)
  ? eligibleCollateral.filter(isPureAda)
  : eligibleCollateral;
const botCollateral = [...collateralCandidates].sort((left, right) => {
  const leftLovelace = getLovelace(left);
  const rightLovelace = getLovelace(right);

  return leftLovelace === rightLovelace
    ? 0
    : leftLovelace < rightLovelace
      ? -1
      : 1;
})[0];

if (!botCollateral) {
  throw new Error(
    `No bot collateral UTxO found with at least ${minimumCollateral} lovelace`,
  );
}

export {
  blockchainProvider,
  botAddress,
  botCollateral,
  botKeyHash,
  botUtxos,
  botWallet,
  txBuilder,
};
