use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/address.{Credential, Script}
use cardano/assets.{AssetName, Lovelace, Value, quantity_of}
use cardano/transaction.{InlineDatum, Input}
use lava/constants.{global_settings_nft, lava_pool_nft_name}
use lava/types.{
  GlobalSettingsDatum, SignerType, SpendScriptSigner, VerificationKeySigner,
  WithdrawScriptSigner,
}

/// validate that the transaction is signed by 'signer'
pub fn signed_by(
  signatories: List<VerificationKeyHash>,
  signer: VerificationKeyHash,
) {
  signatories |> list.has(signer)
}

/// Multisig signature
pub fn is_multisig_signing(inputs: List<Input>, admin_sc: ScriptHash) {
  list.any(
    inputs,
    fn(input) { input.output.address.payment_credential == Script(admin_sc) },
  )
}

/// Finds a reference input of the global settings validator
pub fn find_gs_ref_input(
  ref_inputs: List<Input>,
  gs_validator_hash: ScriptHash,
  the_asset_name: AssetName,
) {
  ref_inputs
    |> list.find(
        fn(ref_i) {
          and {
            (Script(gs_validator_hash) == ref_i.output.address.payment_credential)?,
            (quantity_of(ref_i.output.value, gs_validator_hash, the_asset_name) == 1)?,
          }
        },
      )
}

/// Get global settings
pub fn get_global_settings(
  reference_inputs: List<Input>,
  gs_validator_hash: ScriptHash,
) -> GlobalSettingsDatum {
  // find global settings from reference inputs
  expect Some(global_settings_ref) =
    find_gs_ref_input(reference_inputs, gs_validator_hash, global_settings_nft)
  expect InlineDatum(global_settings) = global_settings_ref.output.datum
  expect GlobalSettingsDatum {
    admin,
    authorized_batchers,
    allowed_assets,
    mint_validator_hash,
    stake_details,
    frost_address,
  } = global_settings

  GlobalSettingsDatum {
    admin,
    authorized_batchers,
    allowed_assets,
    mint_validator_hash,
    stake_details,
    frost_address,
  }
}

/// Gets the Signer Hash
pub fn get_signer_hash(signer: SignerType) {
  let signer_hash =
    when signer is {
      VerificationKeySigner { verification_key_hash } -> verification_key_hash
      SpendScriptSigner { script_hash } -> script_hash
      WithdrawScriptSigner { script_hash } -> script_hash
    }

  signer_hash
}

/// Makes sure signer signs the transaction
pub fn is_signed_by(
  extra_signatories: List<VerificationKeyHash>,
  inputs: List<Input>,
  withdrawals: Pairs<Credential, Lovelace>,
  signer: SignerType,
) {
  when signer is {
    VerificationKeySigner { verification_key_hash } ->
      list.has(extra_signatories, verification_key_hash)
    SpendScriptSigner { script_hash } ->
      list.any(
        inputs,
        fn(input) {
          input.output.address.payment_credential == Script(script_hash)
        },
      )
    WithdrawScriptSigner { script_hash } ->
      pairs.has_key(withdrawals, Script(script_hash))
  }
}

/// Finds pool input
pub fn find_pool_input(inputs: List<Input>, pool_validator_hash: ScriptHash) {
  list.filter(
    inputs,
    fn(input) {
      and {
        (input.output.address.payment_credential == Script(pool_validator_hash))?,
        (quantity_of(
          input.output.value,
          pool_validator_hash,
          lava_pool_nft_name,
        ) == 1)?,
      }
    },
  )
}
