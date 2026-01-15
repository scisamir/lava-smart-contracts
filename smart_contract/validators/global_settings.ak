use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Script}
use cardano/assets.{AssetName, PolicyId, from_asset, from_lovelace}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use lava/constants.{global_settings_nft}
use lava/types.{
  GlobalSettingsDatum, SpendScriptSigner, StakeType, WithdrawScriptSigner,
}
use lava/utils.{is_multisig_signing}
use mocktail/virgin_address.{mock_pub_key_address, mock_script_address}
use mocktail/virgin_key_hash.{mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{allowed_ast_one, utxo_ref_t}
use test_utils/fns_t.{get_admin_input}

validator global_settings(
  // utxo ref: change of this changes the hash of the global settings validator
  // in turn changing the hash of all validators
  utxo_ref: OutputReference,
) {
  spend(
    datum: Option<GlobalSettingsDatum>,
    _redeemer: Data,
    utxo: OutputReference,
    self: Transaction,
  ) {
    let Transaction { inputs, outputs, .. } = self
    expect Some(own_input) = transaction.find_input(inputs, utxo)
    expect Script(own_hash) = own_input.output.address.payment_credential

    expect Some(GlobalSettingsDatum { admin, .. }) = datum

    validate_update_gs(inputs, outputs, own_hash, admin)
  }

  mint(_redeemer: Data, policy_id: PolicyId, self: Transaction) {
    let Transaction { inputs, outputs, mint, .. } = self

    expect [Pair(name, quantity)] =
      mint |> assets.tokens(policy_id) |> dict.to_pairs

    validate_create_gs(inputs, outputs, policy_id, name, quantity, utxo_ref)
  }

  else(_) {
    fail
  }
}

fn validate_create_gs(
  inputs: List<Input>,
  outputs: List<Output>,
  policy_id: PolicyId,
  name: AssetName,
  quantity: Int,
  utxo_ref: OutputReference,
) {
  expect Some(the_output) =
    list.find(
      outputs,
      fn(output) {
        // Must be a UTxO going to own hash
        output.address.payment_credential == Script(policy_id)
      },
    )

  expect InlineDatum(output_datum) = the_output.datum

  // output datum should be of the correct type
  expect GlobalSettingsDatum { admin, .. } = output_datum

  // utxo ref must be spent
  expect Some(_) = find_input(inputs, utxo_ref)

  and {
    // Must only contain "GSN" NFT apart from ADA
    (assets.without_lovelace(the_output.value) == from_asset(
      policy_id,
      global_settings_nft,
      1,
    ))?,
    // Must mint only 1 quantity of global_settings_nft token
    (name == global_settings_nft)?,
    (quantity == 1)?,
    // admin must sign the transaction
    is_multisig_signing(inputs, admin)?,
  }
}

fn validate_update_gs(
  inputs: List<Input>,
  outputs: List<Output>,
  own_hash: PolicyId,
  admin: ScriptHash,
) {
  and {
    validate_settings_output(outputs, own_hash)?,
    is_multisig_signing(inputs, admin)?,
  }
}

fn validate_settings_output(outputs: List<Output>, own_hash: PolicyId) {
  expect [control_output] =
    list.filter(
      outputs,
      fn(output) {
        // Must be a UTxO going to own hash
        (output.address.payment_credential == Script(own_hash))?
      },
    )

  expect InlineDatum(output_datum) = control_output.datum
  // Datum must be of type GlobalSettingsDatum
  expect GlobalSettingsDatum { .. } = output_datum

  // Must only contain "GSN" NFT apart from ADA
  (assets.without_lovelace(control_output.value) == from_asset(
    own_hash,
    global_settings_nft,
    1,
  ))?
}

// Tests
test test_create_global_settings() {
  let global_settings_validator_hash = mock_script_hash(0)
  let gsn = from_asset(global_settings_validator_hash, global_settings_nft, 1)
  let (admin_sc, admin_input) = get_admin_input()

  let global_settings_output =
    Output {
      address: Address {
        payment_credential: Script(global_settings_validator_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2000000), gsn),
      datum: InlineDatum(
        GlobalSettingsDatum {
          admin: admin_sc,
          authorized_batchers: [WithdrawScriptSigner { script_hash: admin_sc }],
          allowed_assets: [],
          mint_validator_hash: mock_script_hash(15),
          stake_details: [
            StakeType {
              asset_type: allowed_ast_one,
              pool_stake_asset_name: "stTest",
              address: Some(mock_script_address(14, None)),
              datum_verifier_hash: Some(mock_script_hash(14)),
            },
          ],
          frost_address: mock_pub_key_address(16, None),
          authorized_swap_scripts: [mock_script_hash(17)],
          stake_validator_hash: mock_script_hash(31),
          rewards_validator_hash: mock_script_hash(19),
          min_pool_lovelace: 5_000_000,
        },
      ),
      reference_script: None,
    }

  let utxo_ref_input =
    Input {
      output_reference: utxo_ref_t,
      output: Output {
        address: mock_pub_key_address(26, None),
        value: from_lovelace(2000000),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let mint = gsn

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input, utxo_ref_input],
      outputs: [global_settings_output],
      mint,
    }

  global_settings.mint(utxo_ref_t, "", global_settings_validator_hash, tx)
}

test test_update_global_settings() {
  let global_settings_validator_hash = mock_script_hash(0)
  let gsn = from_asset(global_settings_validator_hash, global_settings_nft, 1)
  let (admin_sc, admin_input) = get_admin_input()
  let new_sc = mock_script_hash(13)

  let gs_input_datum =
    GlobalSettingsDatum {
      admin: admin_sc,
      authorized_batchers: [WithdrawScriptSigner { script_hash: admin_sc }],
      allowed_assets: [],
      mint_validator_hash: mock_script_hash(15),
      stake_details: [
        StakeType {
          asset_type: allowed_ast_one,
          pool_stake_asset_name: "stTest",
          address: Some(mock_script_address(14, None)),
          datum_verifier_hash: Some(mock_script_hash(14)),
        },
      ],
      frost_address: mock_pub_key_address(16, None),
      authorized_swap_scripts: [mock_script_hash(17)],
      stake_validator_hash: mock_script_hash(31),
      rewards_validator_hash: mock_script_hash(19),
      min_pool_lovelace: 5_000_000,
    }
  let gs_input_utxo_ref = mock_utxo_ref(0, 11)
  let gs_input =
    Input {
      output_reference: gs_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(global_settings_validator_hash),
          stake_credential: None,
        },
        value: assets.merge(from_lovelace(2000000), gsn),
        datum: InlineDatum(gs_input_datum),
        reference_script: None,
      },
    }

  let gs_output =
    Output {
      address: Address {
        payment_credential: Script(global_settings_validator_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2000000), gsn),
      datum: InlineDatum(
        GlobalSettingsDatum {
          admin: admin_sc,
          authorized_batchers: [
            WithdrawScriptSigner { script_hash: admin_sc },
            SpendScriptSigner { script_hash: new_sc },
          ],
          allowed_assets: [],
          mint_validator_hash: mock_script_hash(15),
          stake_details: [
            StakeType {
              asset_type: allowed_ast_one,
              pool_stake_asset_name: "stTest",
              address: Some(mock_script_address(14, None)),
              datum_verifier_hash: Some(mock_script_hash(14)),
            },
          ],
          frost_address: mock_pub_key_address(16, None),
          authorized_swap_scripts: [mock_script_hash(17)],
          stake_validator_hash: mock_script_hash(31),
          rewards_validator_hash: mock_script_hash(19),
          min_pool_lovelace: 5_000_000,
        },
      ),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input, gs_input],
      outputs: [gs_output],
    }

  global_settings.spend(
    utxo_ref_t,
    Some(gs_input_datum),
    "",
    gs_input_utxo_ref,
    tx,
  )
}
