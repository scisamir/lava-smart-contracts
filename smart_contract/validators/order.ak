use aiken/collection/dict
use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Credential, Script, VerificationKey}
use cardano/assets.{
  AssetName, PolicyId, Value, from_asset, from_lovelace, quantity_of,
  without_lovelace,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use lava/types.{CancelOrder, OrderDatum, OrderRedeemer, ProcessOrder}
use lava/utils.{signed_by}
use mocktail/virgin_address.{mock_pub_key_address}
use mocktail/virgin_key_hash.{
  mock_policy_id, mock_pub_key_hash, mock_script_hash,
}
use mocktail/virgin_output_reference.{mock_utxo_ref}

validator order_validator(pool_batching_cred: Credential) {
  spend(
    _datum: Option<OrderDatum>,
    _redeemer: Data,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    let Transaction { inputs, .. } = tx

    expect Some(order_input) = find_input(inputs, utxo)
    let Input {
      output: Output { address: Address { payment_credential, .. }, .. },
      ..
    } = order_input

    pairs.has_key(tx.withdrawals, payment_credential)?
  }

  withdraw(redeemer: OrderRedeemer, account: Credential, tx: Transaction) {
    let Transaction { inputs, outputs, extra_signatories, withdrawals, .. } = tx

    when redeemer is {
      CancelOrder -> {
        expect Script(own_hash) = account

        // only one order input when cancelling an order
        expect [order_input] =
          list.filter(
            inputs,
            fn(input) {
              input.output.address.payment_credential == Script(own_hash)
            },
          )

        expect InlineDatum(order_datum) = order_input.output.datum
        expect OrderDatum { receiver_address, canceller, .. } = order_datum

        expect Some(_order_output) =
          list.find(
            outputs,
            fn(output) {
              // order output must go to 'receiver address'
              and {
                (output.address == receiver_address)?,
                (output.value == order_input.output.value)?,
              }
            },
          )

        signed_by(extra_signatories, canceller)?
      }

      ProcessOrder -> pairs.has_key(withdrawals, pool_batching_cred)?
    }
  }

  else(_) {
    fail
  }
}
