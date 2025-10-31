use aiken/collection/dict
use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Credential, Script, VerificationKey}
use cardano/assets.{
  AssetName, PolicyId, Value, from_asset, from_lovelace, lovelace_of,
  quantity_of, without_lovelace,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use lava/constants.{global_settings_nft, lava_pool_nft_name, min_pool_lovelace}
use lava/types.{GlobalSettingsDatum, PoolDatum}
use lava/utils.{find_gs_ref_input, is_multisig_signing}
use mocktail/virgin_address.{mock_pub_key_address}
use mocktail/virgin_key_hash.{
  mock_policy_id, mock_pub_key_hash, mock_script_hash,
}
use mocktail/virgin_output_reference.{mock_utxo_ref}

validator pool_validator(gs_validator_hash: ScriptHash) {
  // minting to create pool
  mint(_redeemer: Data, policy_id: PolicyId, tx: Transaction) {
    let Transaction { mint, outputs, inputs, reference_inputs, .. } = tx

    expect [Pair(nft_name, quantity)] =
      mint |> assets.tokens(policy_id) |> dict.to_pairs

    let is_pool_nft_minting = and {
        (nft_name == lava_pool_nft_name)?,
        (quantity == 1)?,
      }

    // only one pool output
    expect Some(pool_output) =
      list.find(
        outputs,
        fn(output) { output.address.payment_credential == Script(policy_id) },
      )

    // find global settings from reference inputs
    expect Some(global_settings_ref) =
      find_gs_ref_input(
        reference_inputs,
        gs_validator_hash,
        global_settings_nft,
      )
    expect InlineDatum(global_settings) = global_settings_ref.output.datum
    expect GlobalSettingsDatum { admin, allowed_assets, .. } = global_settings

    // pool datum must be of the expected type PoolDatum
    expect InlineDatum(pool_datum) = pool_output.datum
    expect PoolDatum { pool_asset, .. } = pool_datum

    let is_pool_value_valid = and {
        (assets.without_lovelace(pool_output.value) == from_asset(
          policy_id,
          lava_pool_nft_name,
          1,
        ))?,
        (lovelace_of(pool_output.value) == min_pool_lovelace)?,
      }

    and {
      // pool NFT has to be minted
      is_pool_nft_minting?,
      // admin must sign pool creation transaction
      is_multisig_signing(inputs, admin)?,
      // The pool asset should be an allowed asset
      list.has(allowed_assets, pool_asset)?,
      // pool utxo must contain only the pool nft and min pool lovelace
      is_pool_value_valid?,
    }
  }

  // spending from pool to batch transactions
  spend(
    datum: Option<PoolDatum>,
    _redeemer: Data,
    _utxo: OutputReference,
    tx: Transaction,
  ) {
    expect Some(PoolDatum { pool_batching_cred, .. }) = datum
    pairs.has_key(tx.withdrawals, pool_batching_cred)?
  }

  else(_) {
    fail
  }
}
