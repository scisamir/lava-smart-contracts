import { stringToHex } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, alwaysSuccessValidatorMintScript, testAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";

const unsignedTx = await txBuilder
    .mintPlutusScriptV3()
    .mint("30000", alwaysSuccessMintValidatorHash, testAssetName)
    .mintingScript(alwaysSuccessValidatorMintScript)
    .mintRedeemerValue("")
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

console.log(`Mint ${testAssetName} tx hash:`, txHash);
