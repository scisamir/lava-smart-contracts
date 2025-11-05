import { mConStr0, mConStr1, mPubKeyAddress, mScriptAddress, stringToHex } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, testUnit, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1SK, wallet1Utxos, wallet1VK } from "../setup.js";
import { OrderValidatorAddr } from "./validator.js";

const depositAmount = 1000;
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
            { unit: testUnit, quantity: String(depositAmount) },
        ]
    )
    .txOutInlineDatumValue(orderDatum)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("Create optin order tx hash:", txHash);
