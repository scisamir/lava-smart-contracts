use aiken/collection/list
use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/address.{Script}
use cardano/assets.{AssetName, quantity_of}
use cardano/transaction.{Input}

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
