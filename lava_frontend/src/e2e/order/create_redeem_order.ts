import { IWallet, mConStr0, mConStr1, MeshTxBuilder, mPubKeyAddress, stringToHex, UTxO } from "@meshsdk/core";
import { OrderValidatorAddr } from "./validator";
import { MintingHash } from "../mint/validator";

export const createRedeemOrder = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletUtxos: UTxO[],
    walletVK: string,
    walletSK: string,
    amount: number,
    tokenName: string,
) => {
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
                { unit: MintingHash + stringToHex(tokenName), quantity: String(stAmount) },
            ]
        )
        .txOutInlineDatumValue(orderDatum)
        .changeAddress(walletAddress)
        .selectUtxosFrom(walletUtxos)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    return txHash;
}
