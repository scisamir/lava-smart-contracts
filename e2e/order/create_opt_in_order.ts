import { mConStr0, mPubKeyAddress } from "@meshsdk/core";
import { testUnit, tStrikeUnit, txBuilder, wallet1, wallet1Address, wallet1SK, wallet1Utxos, wallet1VK } from "../setup.js";
import { OrderValidatorAddr } from "./validator.js";

const depositAmount = 200;
const orderType = mConStr0([ depositAmount ]);

const orderDatum = mConStr0([
    orderType,
    mPubKeyAddress(wallet1VK, wallet1SK), // receiver address
    wallet1VK, // canceller
]);

const unsignedTx = await txBuilder
    .txOut(
        OrderValidatorAddr,
        [
            { unit: "lovelace", quantity: "2000000" }, // 2 ADA min UTxO input
            // { unit: tStrikeUnit, quantity: String(depositAmount) },
            { unit: testUnit, quantity: String(depositAmount) },
        ]
    )
    .txOutInlineDatumValue(orderDatum)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("Create optin order tx hash:", txHash);
