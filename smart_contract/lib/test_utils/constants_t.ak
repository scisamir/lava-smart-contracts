use mocktail/virgin_address.{mock_script_credential}
use mocktail/virgin_key_hash.{mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}

pub const utxo_ref_t = mock_utxo_ref(0, 23)

pub const admin_t = mock_script_hash(10)

pub const pool_batching_cred_t = mock_script_credential(19)

pub const gs_validator_hash_t = mock_script_hash(0)

pub const mint_validator_hash_t = mock_script_hash(15)

pub const pool_validator_hash_t = mock_script_hash(18)
