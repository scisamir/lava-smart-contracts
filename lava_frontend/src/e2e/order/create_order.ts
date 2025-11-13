import { IWallet, mConStr0, mConStr1, MeshTxBuilder, mPubKeyAddress, mScriptAddress, stringToHex, UTxO } from "@meshsdk/core";
import { setupE2e } from "../setup.js";
import { OrderValidatorAddr } from "./validator.js";

const createOrder = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    walletSK: string,
) => {
    const { alwaysSuccessMintValidatorHash, testUnit } = setupE2e();
    const depositAmount = 1000;
    const orderType = mConStr0([depositAmount]);

    const orderDatum = mConStr0([
        orderType,
        mPubKeyAddress(walletVK, walletSK), // receiver address
        walletVK, // canceller
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
            walletCollateral.input.txHash,
            walletCollateral.input.outputIndex,
            walletCollateral.output.amount,
            walletCollateral.output.address,
        )
        .changeAddress(walletAddress)
        .selectUtxosFrom(walletUtxos)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    console.log("Create optin order tx hash:", txHash);
}
