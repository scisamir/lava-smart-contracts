use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Credential}
use cardano/assets.{Lovelace, PolicyId, from_asset}
use cardano/transaction.{Transaction, placeholder}
use lava/types.{GlobalSettingsDatum}
use lava/utils.{get_global_settings}
use test_utils/constants_t.{
  gs_validator_hash_t, mint_validator_hash_t, pool_batching_cred_t,
}
use test_utils/fns_t.{get_global_settings_input}

validator minting(
  pool_batching_cred: Credential,
  gs_validator_hash: ScriptHash,
) {
  mint(_redeemer: Data, policy_id: PolicyId, tx: Transaction) {
    let Transaction { reference_inputs, withdrawals, .. } = tx

    // find global settings from reference inputs
    let GlobalSettingsDatum { mint_validator_hash, .. } =
      get_global_settings(reference_inputs, gs_validator_hash)

    validate_minting(
      policy_id,
      mint_validator_hash,
      withdrawals,
      pool_batching_cred,
    )
  }

  else(_) {
    fail
  }
}

fn validate_minting(
  policy_id: PolicyId,
  mint_validator_hash: ScriptHash,
  withdrawals: Pairs<Credential, Lovelace>,
  pool_batching_cred: Credential,
) {
  and {
    // policy ID of mint validator must be same in global settings datum
    (policy_id == mint_validator_hash)?,
    // pool batching is successful
    pairs.has_key(withdrawals, pool_batching_cred)?,
  }
}

test test_mint() {
  let gs_input = get_global_settings_input()

  let mint = from_asset(mint_validator_hash_t, "test", 100)

  let tx =
    Transaction {
      ..placeholder,
      reference_inputs: [gs_input],
      mint,
      withdrawals: [Pair(pool_batching_cred_t, 0)],
    }

  minting.mint(
    pool_batching_cred_t,
    gs_validator_hash_t,
    "",
    mint_validator_hash_t,
    tx,
  )
}

test test_burn() {
  let gs_input = get_global_settings_input()

  let mint = from_asset(mint_validator_hash_t, "test", -100)

  let tx =
    Transaction {
      ..placeholder,
      reference_inputs: [gs_input],
      mint,
      withdrawals: [Pair(pool_batching_cred_t, 0)],
    }

  minting.mint(
    pool_batching_cred_t,
    gs_validator_hash_t,
    "",
    mint_validator_hash_t,
    tx,
  )
}
