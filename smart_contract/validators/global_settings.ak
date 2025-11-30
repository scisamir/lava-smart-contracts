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
  CreateGlobalSettings, GlobalSettingsDatum, GlobalSettingsRedeemer,
  SpendScriptSigner, StakeType, UpdateGlobalSettings, WithdrawScriptSigner,
}
use lava/utils.{is_multisig_signing}
use mocktail/virgin_address.{mock_pub_key_address, mock_script_address}
use mocktail/virgin_key_hash.{mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{allowed_ast_one, utxo_ref_t}
use test_utils/fns_t.{get_admin_input}

validator global_settings(
  admin_sc: ScriptHash,
  // utxo ref: change of this changes the hash of the global settings validator
  // in turn changing the hash of all validators
  utxo_ref: OutputReference,
) {
  spend(
    _datum: Option<GlobalSettingsDatum>,
    redeemer: GlobalSettingsRedeemer,
    utxo: OutputReference,
    self: Transaction,
  ) {
    let Transaction { inputs, outputs, .. } = self
    expect Some(own_input) = transaction.find_input(inputs, utxo)
    expect Script(own_hash) = own_input.output.address.payment_credential

    when redeemer is {
      UpdateGlobalSettings ->
        validate_update_gs(inputs, outputs, own_input, own_hash, admin_sc)
      _ -> fail
    }
  }

  mint(redeemer: GlobalSettingsRedeemer, policy_id: PolicyId, self: Transaction) {
    let Transaction { inputs, outputs, mint, .. } = self

    expect [Pair(name, quantity)] =
      mint |> assets.tokens(policy_id) |> dict.to_pairs

    when redeemer is {
      CreateGlobalSettings ->
        validate_create_gs(
          inputs,
          outputs,
          policy_id,
          name,
          quantity,
          admin_sc,
          utxo_ref,
        )
      _ -> fail
    }
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
  admin_sc: ScriptHash,
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
    is_multisig_signing(inputs, admin_sc)?,
    // admin must be correct in datum
    (admin_sc == admin)?,
  }
}

fn validate_update_gs(
  inputs: List<Input>,
  outputs: List<Output>,
  own_input: Input,
  own_hash: PolicyId,
  admin_sc: ScriptHash,
) {
  and {
    validate_settings_input(own_input, own_hash, admin_sc)?,
    validate_settings_output(outputs, own_hash, admin_sc)?,
    is_multisig_signing(inputs, admin_sc)?,
  }
}

fn validate_settings_input(
  input: Input,
  own_hash: PolicyId,
  admin_sc: ScriptHash,
) {
  expect InlineDatum(input_datum) = input.output.datum
  // Datum must of type GlobalSettingsDatum
  expect GlobalSettingsDatum { admin, .. } = input_datum

  and {
    // Must be a UTxO from own hash
    (input.output.address.payment_credential == Script(own_hash))?,
    // Must only contain "GSN" NFT apart from ADA
    (assets.without_lovelace(input.output.value) == from_asset(
      own_hash,
      global_settings_nft,
      1,
    ))?,
    // admin must be correct in datum
    (admin_sc == admin)?,
  }
}

fn validate_settings_output(
  outputs: List<Output>,
  own_hash: PolicyId,
  admin_sc: ScriptHash,
) {
  let control_outputs =
    list.filter(
      outputs,
      fn(output) {
        // Must be a UTxO going to own hash
        (output.address.payment_credential == Script(own_hash))?
      },
    )
  // Only one output
  expect list.length(control_outputs) == 1

  expect Some(control_output) = list.at(control_outputs, 0)

  expect InlineDatum(output_datum) = control_output.datum
  // Datum must be of type GlobalSettingsDatum
  expect GlobalSettingsDatum { admin, .. } = output_datum

  and {
    // Must only contain "GSN" NFT apart from ADA
    (assets.without_lovelace(control_output.value) == from_asset(
      own_hash,
      global_settings_nft,
      1,
    ))?,
    // admin must be correct in datum
    (admin_sc == admin)?,
  }
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
              address: mock_script_address(14, None),
              datum_verifier_hash: mock_script_hash(14),
            },
          ],
          frost_address: mock_pub_key_address(16, None),
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

  global_settings.mint(
    admin_sc,
    utxo_ref_t,
    CreateGlobalSettings,
    global_settings_validator_hash,
    tx,
  )
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
          address: mock_script_address(14, None),
          datum_verifier_hash: mock_script_hash(14),
        },
      ],
      frost_address: mock_pub_key_address(16, None),
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
              address: mock_script_address(14, None),
              datum_verifier_hash: mock_script_hash(14),
            },
          ],
          frost_address: mock_pub_key_address(16, None),
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
    admin_sc,
    utxo_ref_t,
    Some(gs_input_datum),
    UpdateGlobalSettings,
    gs_input_utxo_ref,
    tx,
  )
}
