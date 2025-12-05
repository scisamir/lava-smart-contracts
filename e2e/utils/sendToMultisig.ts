import { multiSigAddress, txBuilder, wallet1, wallet1Address, wallet1Utxos } from "../setup.js";

// const theUtxo = (await blockchainProvider.fetchUTxOs("abc2437d60829d0b775d169c6bb0f049e3d7894136efb4ccb09e52e70c987c5d", 10))[0];

const unsignedTx = await txBuilder
    // .txIn(
    //     theUtxo.input.txHash,
    //     theUtxo.input.outputIndex,
    //     theUtxo.output.amount,
    //     theUtxo.output.address,
    // )
    .txOut(multiSigAddress, [{ unit: "lovelace", quantity: "10000000" }])
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('send to multisig tx Hash:', txHash);
