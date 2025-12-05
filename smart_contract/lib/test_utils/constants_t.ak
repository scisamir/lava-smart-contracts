use lava/types.{AssetType}
use mocktail/virgin_address.{mock_script_credential}
use mocktail/virgin_key_hash.{mock_policy_id, mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}

pub const utxo_ref_t = mock_utxo_ref(0, 23)

pub const admin_t = mock_script_hash(10)

pub const pool_batching_cred_t = mock_script_credential(19)

pub const gs_validator_hash_t = mock_script_hash(0)

pub const mint_validator_hash_t = mock_script_hash(15)

pub const pool_validator_hash_t = mock_script_hash(18)

pub const allowed_ast_one_pid = mock_policy_id(11)

pub const allowed_ast_one_an = "test"

pub const allowed_ast_one =
  AssetType {
    is_stable: False,
    policy_id: allowed_ast_one_pid,
    asset_name: allowed_ast_one_an,
    multiplier: 1_000_000,
  }
