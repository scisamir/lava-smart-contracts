use cardano/assets.{PolicyId}
use cardano/transaction.{Transaction}

validator placeholder {
  mint(_redeemer: Data, _policy_id: PolicyId, _self: Transaction) {
    True
  }

  else(_) {
    fail
  }
}

test test_things() {
  let things = "LPN"

  trace @"things": things
  Void
}
