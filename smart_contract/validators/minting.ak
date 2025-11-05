use aiken/collection/dict
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Credential}
use cardano/assets.{Lovelace, PolicyId, from_asset}
use cardano/transaction.{InlineDatum, Input, Transaction, placeholder}
use lava/constants.{global_settings_nft}
use lava/types.{Burn, GlobalSettingsDatum, Mint, MintRedeemer}
use lava/utils.{find_gs_ref_input, is_multisig_signing}
use test_utils/constants_t.{
  gs_validator_hash_t, mint_validator_hash_t, pool_batching_cred_t,
}
use test_utils/fns_t.{get_admin_input, get_global_settings_input}

validator minting(
  pool_batching_cred: Credential,
  gs_validator_hash: ScriptHash,
) {
  mint(redeemer: MintRedeemer, policy_id: PolicyId, tx: Transaction) {
    let Transaction { inputs, mint, reference_inputs, withdrawals, .. } = tx

    expect [Pair(_, mint_quantity)] =
      mint |> assets.tokens(policy_id) |> dict.to_pairs()

    // find global settings from reference inputs
    expect Some(global_settings_ref) =
      find_gs_ref_input(
        reference_inputs,
        gs_validator_hash,
        global_settings_nft,
      )
    expect InlineDatum(global_settings) = global_settings_ref.output.datum
    expect GlobalSettingsDatum { admin, mint_validator_hash, .. } =
      global_settings

    validate_minting(
      redeemer,
      admin,
      inputs,
      policy_id,
      mint_validator_hash,
      mint_quantity,
      withdrawals,
      pool_batching_cred,
    )
  }

  else(_) {
    fail
  }
}

fn validate_minting(
  redeemer: MintRedeemer,
  admin: ScriptHash,
  inputs: List<Input>,
  policy_id: PolicyId,
  mint_validator_hash: ScriptHash,
  mint_quantity: Int,
  withdrawals: Pairs<Credential, Lovelace>,
  pool_batching_cred: Credential,
) {
  let is_mint_valid =
    when redeemer is {
      Mint -> mint_quantity > 0
      Burn -> mint_quantity < 0
    }

  and {
    is_mint_valid?,
    // admin must sign pool creation transaction
    is_multisig_signing(inputs, admin)?,
    // policy ID of mint validator must be same in global settings datum
    (policy_id == mint_validator_hash)?,
    // pool batching is successful
    pairs.has_key(withdrawals, pool_batching_cred)?,
  }
}

test test_mint() {
  let (_, admin_input) = get_admin_input()
  let gs_input = get_global_settings_input()

  let mint = from_asset(mint_validator_hash_t, "test", 100)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input, gs_input],
      reference_inputs: [gs_input],
      mint: mint,
      withdrawals: [Pair(pool_batching_cred_t, 0)],
    }

  minting.mint(
    pool_batching_cred_t,
    gs_validator_hash_t,
    Mint,
    mint_validator_hash_t,
    tx,
  )
}

test test_burn() {
  let (_, admin_input) = get_admin_input()
  let gs_input = get_global_settings_input()

  let mint = from_asset(mint_validator_hash_t, "test", -100)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input, gs_input],
      reference_inputs: [gs_input],
      mint: mint,
      withdrawals: [Pair(pool_batching_cred_t, 0)],
    }

  minting.mint(
    pool_batching_cred_t,
    gs_validator_hash_t,
    Burn,
    mint_validator_hash_t,
    tx,
  )
}
