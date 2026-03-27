import { BlockfrostProvider, MeshWallet, type UTxO } from "@meshsdk/core";
import dotenv from "dotenv";
import { BASKET_TOKEN_UNIT, CONFIG } from "./src/config.js";
import { buildWithdrawTx } from "./src/transactions.js";

dotenv.config();

const WITHDRAW_MODE: "amount" | "max" = "max";
const WITHDRAW_BASKET_TOKENS = 1_000_000n;
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

function getAssetBalance(walletUtxos: UTxO[], unit: string): bigint {
  return walletUtxos.reduce((total, utxo) => {
    const assetQuantity =
      utxo.output.amount.find((asset) => asset.unit === unit)?.quantity ?? "0";

    return total + BigInt(assetQuantity);
  }, 0n);
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
  const walletBasketTokenBalance = getAssetBalance(
    walletUtxos,
    BASKET_TOKEN_UNIT,
  );
  const basketTokensToBurn =
    WITHDRAW_MODE === "max" ? walletBasketTokenBalance : WITHDRAW_BASKET_TOKENS;

  if (WITHDRAW_MODE === "amount" && WITHDRAW_BASKET_TOKENS <= 0n) {
    throw new Error("WITHDRAW_BASKET_TOKENS must be positive.");
  }

  if (basketTokensToBurn <= 0n) {
    throw new Error("No Atrium basket tokens available to withdraw.");
  }

  if (walletBasketTokenBalance < basketTokensToBurn) {
    throw new Error(
      `Not enough Atrium basket tokens. Need ${basketTokensToBurn}, found ${walletBasketTokenBalance}.`,
    );
  }

  console.log("walletBasketTokenBalance:", walletBasketTokenBalance);

  console.log(`Wallet: ${walletAddress}`);
  console.log(`Withdraw mode: ${WITHDRAW_MODE}`);
  console.log(
    `Withdrawing from Atrium by burning ${basketTokensToBurn} basket tokens`,
  );

  const unsignedTx = await buildWithdrawTx(
    {
      basketTokensToBurn,
      walletAddress,
    },
    provider,
    walletUtxos,
    collateralUtxo,
  );

  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);

  console.log(`Atrium withdrawal submitted: ${txHash}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
