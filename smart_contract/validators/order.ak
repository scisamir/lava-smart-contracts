use aiken/collection/list
use aiken/collection/pairs
use cardano/address.{Address, Credential, Inline, Script}
use cardano/assets.{from_lovelace}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use lava/types.{CancelOrder, OptIn, OrderDatum, OrderRedeemer, ProcessOrder}
use lava/utils.{signed_by}
use mocktail/virgin_address.{mock_pub_key_address, mock_script_credential}
use mocktail/virgin_key_hash.{mock_pub_key_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{mint_validator_hash_t, pool_batching_cred_t}

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

test test_process_order_opt_in() {
  let receiver_address = mock_pub_key_address(6, None)
  let deposit_amount = 1000
  let extra = 100
  let order_cred = mock_script_credential(16)
  let creation_time = 1762929745

  let order_utxo_ref = mock_utxo_ref(0, 16)
  let order_datum =
    OrderDatum {
      order_type: OptIn { deposit_amount, creation_time },
      receiver_address,
      canceller: mock_pub_key_hash(6),
    }

  let order_input =
    Input {
      output_reference: order_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: order_cred,
          stake_credential: Some(Inline(order_cred)),
        },
        value: from_lovelace(2_000_000)
          |> assets.add(mint_validator_hash_t, "test", deposit_amount + extra),
        datum: InlineDatum(order_datum),
        reference_script: None,
      },
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [order_input],
      withdrawals: [Pair(pool_batching_cred_t, 0), Pair(order_cred, 0)],
    }

  order_validator.spend(
    pool_batching_cred_t,
    Some(order_datum),
    "",
    order_utxo_ref,
    tx,
  ) && order_validator.withdraw(
    pool_batching_cred_t,
    ProcessOrder,
    order_cred,
    tx,
  )
}

test test_cancel_order() {
  let receiver_address = mock_pub_key_address(6, None)
  let canceller = mock_pub_key_hash(6)
  let deposit_amount = 1000
  let extra = 100
  let order_cred = mock_script_credential(16)
  let order_value =
    from_lovelace(2_000_000)
      |> assets.add(mint_validator_hash_t, "test", deposit_amount + extra)

  let order_utxo_ref = mock_utxo_ref(0, 16)
  let order_datum =
    OrderDatum {
      order_type: OptIn { deposit_amount, creation_time: 1762929745 },
      receiver_address,
      canceller,
    }
  let order_input =
    Input {
      output_reference: order_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: order_cred,
          stake_credential: Some(Inline(order_cred)),
        },
        value: order_value,
        datum: InlineDatum(order_datum),
        reference_script: None,
      },
    }

  let user_order_output =
    Output {
      address: receiver_address,
      value: order_value,
      datum: NoDatum,
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [order_input],
      outputs: [user_order_output],
      withdrawals: [Pair(order_cred, 0)],
      extra_signatories: [canceller],
    }

  order_validator.spend(
    pool_batching_cred_t,
    Some(order_datum),
    "",
    order_utxo_ref,
    tx,
  ) && order_validator.withdraw(
    pool_batching_cred_t,
    CancelOrder,
    order_cred,
    tx,
  )
}
