import { BlockfrostProvider, MeshWallet, type UTxO } from "@meshsdk/core";
import dotenv from "dotenv";
import { CONFIG } from "./src/config.js";
import { buildDepositTx } from "./src/transactions.js";

dotenv.config();

const DEPOSIT_LOVELACE = 10_000_000n;
const MIN_COLLATERAL_LOVELACE = 5_000_000n;

function pickCollateralUtxo(walletUtxos: UTxO[]): UTxO {
  const collateral = walletUtxos.find((utxo) => {
    const lovelace = BigInt(
      utxo.output.amount.find((asset) => asset.unit === "lovelace")?.quantity ??
        "0",
    );

    return (
      utxo.output.amount.length === 1 && lovelace >= MIN_COLLATERAL_LOVELACE
    );
  });

  if (!collateral) {
    throw new Error(
      "No pure-ADA collateral UTxO found with at least 5 ADA. Fund the wallet with a separate ADA-only UTxO first.",
    );
  }

  return collateral;
}

async function main(): Promise<void> {
  const mnemonic =
    process.env.ATRIUM_WALLET_MNEMONIC ?? process.env.WALLET_PASSPHRASE_ONE;
  if (!mnemonic) {
    throw new Error(
      "Missing wallet mnemonic. Set ATRIUM_WALLET_MNEMONIC or WALLET_PASSPHRASE_ONE in e2e/.env.",
    );
  }

  const blockfrostApiKey =
    process.env.ATRIUM_BLOCKFROST_API_KEY ??
    process.env.BLOCKFROST_API_KEY ??
    process.env.BLOCKFROST_ID ??
    CONFIG.blockfrostApiKey;

  const provider = new BlockfrostProvider(blockfrostApiKey);
  const wallet = new MeshWallet({
    networkId: 1,
    fetcher: provider,
    submitter: provider,
    key: {
      type: "mnemonic",
      words: mnemonic.trim().split(/\s+/),
    },
  });

  const walletAddress = await wallet.getChangeAddress();
  const walletUtxos = await wallet.getUtxos();
  const collateralUtxo = pickCollateralUtxo(walletUtxos);

  console.log(`Wallet: ${walletAddress}`);
  console.log(`Depositing ${DEPOSIT_LOVELACE} lovelace into Atrium`);

  const unsignedTx = await buildDepositTx(
    {
      depositLovelace: DEPOSIT_LOVELACE,
      walletAddress,
    },
    provider,
    walletUtxos,
    collateralUtxo,
  );

  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);

  console.log(`Atrium deposit submitted: ${txHash}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
