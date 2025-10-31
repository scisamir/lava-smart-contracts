use aiken/collection/dict
use aiken/crypto.{ScriptHash}
use cardano/assets.{PolicyId}
use cardano/transaction.{Transaction}
use lava/types.{Burn, Mint, MintRedeemer}

validator minting(
  pool_validator_hash: ScriptHash,
  global_settings_hash: ScriptHash,
) {
  mint(redeemer: MintRedeemer, policy_id: PolicyId, tx: Transaction) {
    let Transaction {
      mint,
      outputs,
      reference_inputs,
      inputs,
      extra_signatories,
      ..
    } = tx

    expect [Pair(name, quantity)] =
      mint |> assets.tokens(policy_id) |> dict.to_pairs()

    when redeemer is {
      Mint -> True
      Burn -> {
        trace @"test": pool_validator_hash, global_settings_hash, name, quantity, outputs, extra_signatories, inputs, reference_inputs
        True
      }
    }
  }

  else(_) {
    fail
  }
}
