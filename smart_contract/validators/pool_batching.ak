use aiken/crypto.{ScriptHash}
use cardano/address.{Credential}
use cardano/transaction.{Transaction}

validator pool_batching(
  gs_validator_hash: ScriptHash,
  pool_validator_hash: ScriptHash,
) {
  withdraw(_redeemer: Data, _stake_cred: Credential, _tx: Transaction) {
    trace @"hashes": gs_validator_hash, pool_validator_hash
    True
  }

  else(_) {
    fail
  }
}
