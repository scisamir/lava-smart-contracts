import { IWallet, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";
import { setupE2e } from "../setup";

export const mintTestTokens = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
) => {
    const { alwaysSuccessMintValidatorHash, alwaysSuccessValidatorMintScript, tPulseAssetName, tStrikeAssetName } = setupE2e();

    const unsignedTx = await txBuilder
        .mintPlutusScriptV3()
        .mint("1000", alwaysSuccessMintValidatorHash, tStrikeAssetName)
        .mintingScript(alwaysSuccessValidatorMintScript)
        .mintRedeemerValue("")
        .mintPlutusScriptV3()
        .mint("1000", alwaysSuccessMintValidatorHash, tPulseAssetName)
        .mintingScript(alwaysSuccessValidatorMintScript)
        .mintRedeemerValue("")
        .txInCollateral(
            walletCollateral.input.txHash,
            walletCollateral.input.outputIndex,
        )
        .setTotalCollateral("5000000")
        .changeAddress(walletAddress)
        .selectUtxosFrom(walletUtxos)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    return txHash;
}
