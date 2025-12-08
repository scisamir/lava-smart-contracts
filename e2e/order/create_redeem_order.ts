import { mConStr0, mConStr1, mPubKeyAddress } from "@meshsdk/core";
import { poolStakeAssetName, txBuilder, wallet1, wallet1Address, wallet1SK, wallet1Utxos, wallet1VK } from "../setup.js";
import { OrderValidatorAddr } from "./validator.js";
import { MintingHash } from "../mint/validator.js";

const stAmount = 200;
const orderType = mConStr1([ stAmount ]);

const orderDatum = mConStr0([
    orderType,
    mPubKeyAddress(wallet1VK, wallet1SK), // receiver address
    wallet1VK, // canceller
]);

const unsignedTx = await txBuilder
    .txOut(
        OrderValidatorAddr,
        [
            { unit: MintingHash + poolStakeAssetName, quantity: String(stAmount) },
        ]
    )
    .txOutInlineDatumValue(orderDatum)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("Create redeem order tx hash:", txHash);
