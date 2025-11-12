use cardano/address.{Address, Script}
use cardano/assets.{from_asset, from_lovelace}
use cardano/transaction.{InlineDatum, Input, NoDatum, Output}
use lava/constants.{global_settings_nft}
use lava/types.{AssetType, GlobalSettingsDatum}
use mocktail/virgin_key_hash.{mock_policy_id}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{admin_t, gs_validator_hash_t, mint_validator_hash_t}

pub fn get_admin_input() {
  let admin_input =
    Input {
      output_reference: mock_utxo_ref(0, 10),
      output: Output {
        address: Address {
          payment_credential: Script(admin_t),
          stake_credential: None,
        },
        value: from_lovelace(2000000),
        datum: NoDatum,
        reference_script: None,
      },
    }

  (admin_t, admin_input)
}

pub fn get_global_settings_input() {
  let gsn = from_asset(gs_validator_hash_t, global_settings_nft, 1)

  let gs_input_datum =
    GlobalSettingsDatum {
      admin: admin_t,
      authorized_batchers: [admin_t],
      allowed_assets: [
        AssetType {
          is_stable: False,
          policy_id: mock_policy_id(11),
          asset_name: "test",
          multiplier: 1_000_000,
        },
      ],
      mint_validator_hash: mint_validator_hash_t,
      // 5 days
      deposit_waiting_time: 5 * 24 * 60 * 60 * 1000,
    }
  let gs_input_utxo_ref = mock_utxo_ref(0, 11)
  let gs_input =
    Input {
      output_reference: gs_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(gs_validator_hash_t),
          stake_credential: None,
        },
        value: assets.merge(from_lovelace(2000000), gsn),
        datum: InlineDatum(gs_input_datum),
        reference_script: None,
      },
    }

  gs_input
}
