import { IWallet, mConStr0, MeshTxBuilder, mPubKeyAddress, stringToHex, UTxO } from "@meshsdk/core";
import { setupE2e } from "../setup";
import { OrderValidatorAddr } from "./validator";

export const createOptInOrder = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletUtxos: UTxO[],
    walletVK: string,
    walletSK: string,
    amount: number,
    tokenName: string,
) => {
    const { alwaysSuccessMintValidatorHash } = setupE2e();
    const depositAmount = amount; // to lovelaces
    // const depositAmount = amount * 1_000_000; // to lovelaces
    const orderType = mConStr0([depositAmount]);

    const orderDatum = mConStr0([
        orderType,
        mPubKeyAddress(walletVK, walletSK), // receiver address
        walletVK, // canceller
    ]);

    console.log("ooo:", tokenName);

    const unsignedTx = await txBuilder
        .txOut(
            OrderValidatorAddr,
            [
                { unit: "lovelace", quantity: String(2_000_000) },
                { unit: alwaysSuccessMintValidatorHash + stringToHex(tokenName), quantity: String(depositAmount) },
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
