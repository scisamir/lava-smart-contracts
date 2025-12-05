import { IWallet, mConStr0, mConStr1, MeshTxBuilder, mPubKeyAddress, mScriptAddress, stringToHex, UTxO } from "@meshsdk/core";
import { setupE2e } from "../setup";
import { OrderValidatorAddr } from "./validator";
import { MintingHash } from "../mint/validator";

export const createRedeemOrder = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    walletSK: string,
    amount: number,
) => {
    const { poolStakeAssetName } = setupE2e();
    const stAmount = amount; // to lovelaces
    // const depositAmount = amount * 1_000_000; // to lovelaces
    const orderType = mConStr1([stAmount]);

    const orderDatum = mConStr0([
        orderType,
        mPubKeyAddress(walletVK, walletSK), // receiver address
        walletVK, // canceller
    ]);

    const unsignedTx = await txBuilder
        .txOut(
            OrderValidatorAddr,
            [
                { unit: "lovelace", quantity: String(2_000_000) },
                { unit: MintingHash + poolStakeAssetName, quantity: String(stAmount) },
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

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    return txHash;
}
