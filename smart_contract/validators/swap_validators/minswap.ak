use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Credential, Script}
use cardano/assets.{
  from_asset, from_lovelace, lovelace_of, quantity_of, without_lovelace,
}
use cardano/transaction.{InlineDatum, Transaction}
use external/minswap_types.{EODNoDatum, MinswapOrderDatum}
use lava/types.{AssetType, SwapRedeemer}

validator minswap_swap(
  minswap_order_validator_hash: ScriptHash,
  rewards_address: Address,
) {
  withdraw(redeemer: SwapRedeemer, _account: Credential, tx: Transaction) {
    let Transaction { inputs, outputs, .. } = tx

    expect Script(rewards_validator_hash) = rewards_address.payment_credential

    let SwapRedeemer {
      swap_from_asset,
      lp_asset: lp_asset_r,
      max_batcher_fee: max_batcher_fee_r,
    } = redeemer
    let AssetType { policy_id: fa_pid, asset_name: fa_an, .. } = swap_from_asset
    let is_fa_ada = fa_pid == "" && fa_an == "lovelace"

    // Reward utxo must contain only the specified asset apart from ADA
    expect [reward_utxo] =
      list.filter(
        inputs,
        fn(input) {
          and {
            input.output.address.payment_credential == Script(
              rewards_validator_hash,
            ),
            if is_fa_ada {
              input.output.value == from_lovelace(
                lovelace_of(input.output.value),
              )
            } else {
              without_lovelace(input.output.value) == from_asset(
                fa_pid,
                fa_an,
                quantity_of(input.output.value, fa_pid, fa_an),
              )
            },
          }
        },
      )

    expect [order_utxo] =
      list.filter(
        outputs,
        fn(output) {
          and {
            output.address.payment_credential == Script(
              minswap_order_validator_hash,
            ),
            if is_fa_ada {
              output.value == from_lovelace(
                lovelace_of(reward_utxo.output.value),
              )
            } else {
              without_lovelace(output.value) == from_asset(
                fa_pid,
                fa_an,
                quantity_of(reward_utxo.output.value, fa_pid, fa_an),
              )
            },
          }
        },
      )

    expect InlineDatum(order_utxo_datum) = order_utxo.datum
    expect MinswapOrderDatum {
      refund_receiver,
      refund_receiver_datum,
      success_receiver,
      success_receiver_datum,
      lp_asset,
      max_batcher_fee,
      expiry_setting_opt,
      ..
    } = order_utxo_datum

    expect EODNoDatum = refund_receiver_datum
    expect EODNoDatum = success_receiver_datum
    expect None = expiry_setting_opt
    let is_order_datum_valid = and {
        (refund_receiver == rewards_address)?,
        (success_receiver == rewards_address)?,
        (lp_asset == lp_asset_r)?,
        (max_batcher_fee == max_batcher_fee_r)?,
      }

    is_order_datum_valid?
  }

  else(_) {
    fail
  }
}
