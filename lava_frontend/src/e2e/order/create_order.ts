import { IWallet, mConStr0, mConStr1, MeshTxBuilder, mPubKeyAddress, mScriptAddress, stringToHex, UTxO } from "@meshsdk/core";
import { setupE2e } from "../setup";
import { OrderValidatorAddr } from "./validator";

export const createOrder = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    walletSK: string,
    amount: number,
) => {
    const { alwaysSuccessMintValidatorHash, testUnit } = setupE2e();
    const depositAmount = amount * 1_000_000; // to lovelaces
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
                { unit: "lovelace", quantity: String(depositAmount) },
            ]
            // [
            //     { unit: testUnit, quantity: String(depositAmount) },
            // ]
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

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    return txHash;
}
