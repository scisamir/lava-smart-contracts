use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Credential, Script}
use cardano/assets.{
  PolicyId, from_asset, from_lovelace, lovelace_of, quantity_of,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, Transaction, placeholder,
}
use external/constants_e.{atrium_diffusion, stake_pool_an, stake_pool_pid}
use external/stake_types.{ExternalStakeRedeemer}
use lava/constants.{global_settings_nft}
use lava/types.{AssetType, GlobalSettingsDatum, StakeType}
use lava/utils.{get_global_settings}
use mocktail/virgin_address.{mock_script_address, mock_script_credential}
use mocktail/virgin_key_hash.{mock_policy_id, mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{admin_signer_t, gs_validator_hash_t}

type AtriumStakePoolDatum {
  pool_pkh: Option<ByteArray>,
  basket_token_counter: Int,
}

validator atrium(
  gs_validator_hash: ScriptHash,
  atrium_minting_pid: PolicyId,
  reward_address: Address,
) {
  withdraw(
    redeemer: ExternalStakeRedeemer,
    _account: Credential,
    tx: Transaction,
  ) {
    let Transaction { inputs, outputs, reference_inputs, mint, .. } = tx

    let ExternalStakeRedeemer { pool_stake_asset_name: ps_asset_name, .. } =
      redeemer
    let GlobalSettingsDatum { stake_details, .. } =
      get_global_settings(reference_inputs, gs_validator_hash)

    expect [StakeType { address: stake_address_opt, .. }] =
      list.filter(
        stake_details,
        fn(sd) {
          let StakeType { pool_stake_asset_name, .. } = sd
          pool_stake_asset_name == ps_asset_name
        },
      )
    expect Some(stake_address) = stake_address_opt

    expect [atrium_input] =
      list.filter(
        inputs,
        fn(input) {
          and {
            (input.output.address == stake_address)?,
            (quantity_of(input.output.value, stake_pool_pid, stake_pool_an) == 1)?,
          }
        },
      )
    expect [atrium_output] =
      list.filter(
        outputs,
        fn(output) {
          and {
            (output.address == stake_address)?,
            (quantity_of(output.value, stake_pool_pid, stake_pool_an) == 1)?,
          }
        },
      )

    // Atrium mint must be successful and positive
    expect [Pair(mint_name, mint_amount)] =
      mint |> assets.tokens(atrium_minting_pid) |> dict.to_pairs

    // Atrium diffusion tokens must go to the reward address
    expect [reward_output] =
      list.filter(outputs, fn(output) { output.address == reward_address })

    expect NoDatum = reward_output.datum

    and {
      (mint_amount > 0)?,
      (mint_name == atrium_diffusion)?,
      (lovelace_of(atrium_output.value) > lovelace_of(atrium_input.output.value))?,
      (quantity_of(reward_output.value, atrium_minting_pid, atrium_diffusion) == mint_amount)?,
    }
  }

  else(_) {
    fail
  }
}

fn get_atrium_global_settings_input(
  stake_address: Address,
  datum_verifier_hash: ScriptHash,
) {
  let gsn = from_asset(gs_validator_hash_t, global_settings_nft, 1)
  let atrium_asset =
    AssetType {
      is_stable: False,
      policy_id: "",
      asset_name: "",
      multiplier: 1_000_000,
    }

  let gs_input_datum =
    GlobalSettingsDatum {
      admin: admin_signer_t,
      authorized_batchers: [admin_signer_t],
      allowed_assets: [atrium_asset],
      mint_validator_hash: mock_script_hash(15),
      stake_details: [
        StakeType {
          asset_type: atrium_asset,
          pool_stake_asset_name: "LADA",
          address: Some(stake_address),
          datum_verifier_hash: Some(datum_verifier_hash),
        },
      ],
      frost_address: mock_script_address(16, None),
      authorized_swap_scripts: [mock_script_hash(17)],
      stake_validator_hash: mock_script_hash(31),
      rewards_validator_hash: mock_script_hash(19),
      min_pool_lovelace: 5_000_000,
    }

  Input {
    output_reference: mock_utxo_ref(0, 11),
    output: Output {
      address: Address {
        payment_credential: Script(gs_validator_hash_t),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2_000_000), gsn),
      datum: InlineDatum(gs_input_datum),
      reference_script: None,
    },
  }
}

test test_atrium_staking_deposit() {
  let reward_address = mock_script_address(20, None)
  let stake_address = mock_script_address(21, None)
  let datum_verifier_hash = mock_script_hash(22)
  let atrium_minting_pid = mock_policy_id(23)
  let gs_input =
    get_atrium_global_settings_input(stake_address, datum_verifier_hash)

  let atrium_input_datum =
    AtriumStakePoolDatum { pool_pkh: None, basket_token_counter: 30 }
  let atrium_output_datum =
    AtriumStakePoolDatum { pool_pkh: None, basket_token_counter: 40 }

  let atrium_input =
    Input {
      output_reference: mock_utxo_ref(0, 24),
      output: Output {
        address: stake_address,
        value: assets.merge(
          from_lovelace(10_000_000),
          from_asset(stake_pool_pid, stake_pool_an, 1),
        ),
        datum: InlineDatum(atrium_input_datum),
        reference_script: None,
      },
    }

  let atrium_output =
    Output {
      address: stake_address,
      value: assets.merge(
        from_lovelace(20_000_000),
        from_asset(stake_pool_pid, stake_pool_an, 1),
      ),
      datum: InlineDatum(atrium_output_datum),
      reference_script: None,
    }

  let reward_output =
    Output {
      address: reward_address,
      value: assets.merge(
        from_lovelace(2_000_000),
        from_asset(atrium_minting_pid, atrium_diffusion, 10),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [atrium_input],
      outputs: [atrium_output, reward_output],
      reference_inputs: [gs_input],
      mint: from_asset(atrium_minting_pid, atrium_diffusion, 10),
    }

  atrium.withdraw(
    gs_validator_hash_t,
    atrium_minting_pid,
    reward_address,
    ExternalStakeRedeemer {
      stake_asset: AssetType {
        is_stable: False,
        policy_id: "",
        asset_name: "",
        multiplier: 1_000_000,
      },
      pool_stake_asset_name: "LADA",
    },
    mock_script_credential(25),
    tx,
  )
}
