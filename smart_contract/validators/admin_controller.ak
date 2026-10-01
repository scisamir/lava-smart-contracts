use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/address.{Credential, Inline, Script, VerificationKey}
use cardano/assets.{Lovelace, from_asset, from_lovelace}
use cardano/transaction.{InlineDatum, Input, Output, Transaction, placeholder}
use lava/constants.{precision_factor}
use lava/types.{
  AssetType, MintScriptSigner, PoolDatum, SignerType, SpendScriptSigner,
  VerificationKeySigner, WithdrawScriptSigner,
}
use lava/utils.{is_signed_by}
use mocktail/virgin_address.{mock_script_address, mock_script_credential}
use mocktail/virgin_key_hash.{mock_pub_key_hash, mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}

pub type AdminControllerRedeemer {
  TogglePool
  FullAdmin
}

validator admin_controller(
  pool_validator_hash: ScriptHash,
  full_admin: SignerType,
  pool_toggler: SignerType,
) {
  withdraw(
    redeemer: AdminControllerRedeemer,
    account: Credential,
    tx: Transaction,
  ) {
    when redeemer is {
      TogglePool ->
        validate_pool_toggle(pool_validator_hash, pool_toggler, account, tx)
      FullAdmin ->
        validate_full_admin(pool_validator_hash, full_admin, account, tx)
    }
  }

  else(_) {
    fail
  }
}

fn validate_full_admin(
  pool_validator_hash: ScriptHash,
  full_admin: SignerType,
  account: Credential,
  tx: Transaction,
) {
  let is_safe_admin =
    when full_admin is {
      SpendScriptSigner { script_hash } -> script_hash != pool_validator_hash
      WithdrawScriptSigner { script_hash } -> Script(script_hash) != account
      _ -> True
    }

  and {
    is_safe_admin,
    is_signed_by(
      tx.extra_signatories,
      tx.inputs,
      tx.withdrawals,
      tx.mint,
      full_admin,
    )?,
  }
}

fn validate_pool_toggle(
  pool_validator_hash: ScriptHash,
  pool_toggler: SignerType,
  account: Credential,
  tx: Transaction,
) {
  let Transaction {
    inputs,
    outputs,
    mint,
    certificates,
    withdrawals,
    extra_signatories,
    votes,
    proposal_procedures,
    treasury_donation,
    ..
  } = tx

  expect [pool_input] =
    list.filter(
      inputs,
      fn(input) {
        input.output.address.payment_credential == Script(pool_validator_hash)
      },
    )

  expect [pool_output] =
    list.filter(
      outputs,
      fn(output) {
        output.address.payment_credential == Script(pool_validator_hash)
      },
    )
  expect pool_output.address == pool_input.output.address
  expect pool_output.value == pool_input.output.value
  expect pool_output.reference_script == pool_input.output.reference_script

  expect InlineDatum(pool_input_datum) = pool_input.output.datum
  expect PoolDatum {
    pool_batching_cred,
    total_st_assets_minted,
    total_underlying,
    exchange_rate,
    total_rewards_accrued,
    pool_asset,
    pool_stake_asset_name,
    is_processing_open,
  } = pool_input_datum

  expect InlineDatum(pool_output_datum) = pool_output.datum
  expect PoolDatum {
    pool_batching_cred: pool_batching_cred_out,
    total_st_assets_minted: total_st_assets_minted_out,
    total_underlying: total_underlying_out,
    exchange_rate: exchange_rate_out,
    total_rewards_accrued: total_rewards_accrued_out,
    pool_asset: pool_asset_out,
    pool_stake_asset_name: pool_stake_asset_name_out,
    is_processing_open: is_processing_open_out,
  } = pool_output_datum

  and {
    validate_toggle_authorization(
      pool_validator_hash,
      pool_toggler,
      account,
      inputs,
      outputs,
      withdrawals,
      extra_signatories,
    )?,
    mint == assets.zero,
    certificates == [],
    votes == [],
    proposal_procedures == [],
    treasury_donation == None,
    pool_batching_cred == pool_batching_cred_out,
    total_st_assets_minted == total_st_assets_minted_out,
    total_underlying == total_underlying_out,
    exchange_rate == exchange_rate_out,
    total_rewards_accrued == total_rewards_accrued_out,
    pool_asset == pool_asset_out,
    pool_stake_asset_name == pool_stake_asset_name_out,
    (is_processing_open != is_processing_open_out)?,
  }
}

fn validate_toggle_authorization(
  pool_validator_hash: ScriptHash,
  pool_toggler: SignerType,
  account: Credential,
  inputs: List<Input>,
  outputs: List<Output>,
  withdrawals: Pairs<Credential, Lovelace>,
  extra_signatories: List<VerificationKeyHash>,
) {
  let script_inputs =
    list.filter(
      inputs,
      fn(input) { is_script_credential(input.output.address.payment_credential) },
    )
  let script_outputs =
    list.filter(
      outputs,
      fn(output) { is_script_credential(output.address.payment_credential) },
    )

  when pool_toggler is {
    VerificationKeySigner { verification_key_hash } ->
      and {
        list.length(script_inputs) == 1,
        list.length(script_outputs) == 1,
        withdrawals == [Pair(account, 0)],
        list.has(extra_signatories, verification_key_hash),
      }

    SpendScriptSigner { script_hash } ->
      and {
        script_hash != pool_validator_hash,
        list.length(script_inputs) == 2,
        list.all(
          script_inputs,
          fn(input) {
            or {
              input.output.address.payment_credential == Script(
                pool_validator_hash,
              ),
              input.output.address.payment_credential == Script(script_hash),
            }
          },
        ),
        list.all(
          script_outputs,
          fn(output) {
            or {
              output.address.payment_credential == Script(pool_validator_hash),
              output.address.payment_credential == Script(script_hash),
            }
          },
        ),
        withdrawals == [Pair(account, 0)],
      }

    WithdrawScriptSigner { script_hash } ->
      and {
        Script(script_hash) != account,
        list.length(script_inputs) == 1,
        list.length(script_outputs) == 1,
        list.length(withdrawals) == 2,
        pairs.get_all(withdrawals, account) == [0],
        pairs.get_all(withdrawals, Script(script_hash)) == [0],
      }

    MintScriptSigner { .. } -> False
  }
}

fn is_script_credential(credential: Credential) {
  when credential is {
    Script(_) -> True
    VerificationKey(_) -> False
  }
}

const test_min_pool_lovelace = 5_000_000

fn test_pool_datum(is_processing_open: Bool) {
  PoolDatum {
    pool_batching_cred: mock_script_credential(1),
    total_st_assets_minted: 10_000_000,
    total_underlying: 11_000_000,
    exchange_rate: 11 * precision_factor / 10,
    total_rewards_accrued: 1_000_000,
    pool_asset: AssetType {
      is_stable: False,
      policy_id: "",
      asset_name: "",
      multiplier: 1_000_000,
    },
    pool_stake_asset_name: "LADA",
    is_processing_open,
  }
}

fn test_pool_input(pool_hash: ScriptHash, datum: PoolDatum) {
  Input {
    output_reference: mock_utxo_ref(0, 2),
    output: Output {
      address: mock_script_address(2, Some(Inline(Script(pool_hash)))),
      value: assets.merge(
        from_lovelace(20_000_000),
        from_asset(pool_hash, "pool nft", 1),
      ),
      datum: InlineDatum(datum),
      reference_script: None,
    },
  }
}

fn test_pool_output(pool_input: Input, datum: PoolDatum) {
  Output {
    address: pool_input.output.address,
    value: pool_input.output.value,
    datum: InlineDatum(datum),
    reference_script: pool_input.output.reference_script,
  }
}

fn test_toggle_transaction(
  pool_input: Input,
  pool_output: Output,
  controller_credential: Credential,
  bot_key_hash: VerificationKeyHash,
) {
  Transaction {
    ..placeholder,
    inputs: [pool_input],
    outputs: [pool_output],
    withdrawals: [Pair(controller_credential, 0)],
    extra_signatories: [bot_key_hash],
  }
}

test test_toggle_pool() {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_key_hash = mock_pub_key_hash(4)
  let controller_credential = mock_script_credential(5)
  let pool_input = test_pool_input(pool_hash, test_pool_datum(True))
  let pool_output = test_pool_output(pool_input, test_pool_datum(False))
  let tx =
    test_toggle_transaction(
      pool_input,
      pool_output,
      controller_credential,
      bot_key_hash,
    )

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    VerificationKeySigner { verification_key_hash: bot_key_hash },
    TogglePool,
    controller_credential,
    tx,
  )
}

test test_toggle_pool_with_spend_script() {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_script_hash = mock_script_hash(4)
  let controller_credential = mock_script_credential(5)
  let pool_input = test_pool_input(pool_hash, test_pool_datum(True))
  let pool_output = test_pool_output(pool_input, test_pool_datum(False))
  let bot_script_input =
    Input {
      output_reference: mock_utxo_ref(0, 4),
      output: Output {
        address: mock_script_address(4, None),
        value: from_lovelace(2_000_000),
        datum: InlineDatum(0),
        reference_script: None,
      },
    }
  let tx =
    Transaction {
      ..test_toggle_transaction(
        pool_input,
        pool_output,
        controller_credential,
        mock_pub_key_hash(4),
      ),
      inputs: [pool_input, bot_script_input],
      extra_signatories: [],
    }

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    SpendScriptSigner { script_hash: bot_script_hash },
    TogglePool,
    controller_credential,
    tx,
  )
}

test test_toggle_pool_with_withdraw_script() {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_script_hash = mock_script_hash(4)
  let controller_credential = mock_script_credential(5)
  let pool_input = test_pool_input(pool_hash, test_pool_datum(True))
  let pool_output = test_pool_output(pool_input, test_pool_datum(False))
  let tx =
    Transaction {
      ..test_toggle_transaction(
        pool_input,
        pool_output,
        controller_credential,
        mock_pub_key_hash(4),
      ),
      withdrawals: [
        Pair(controller_credential, 0),
        Pair(Script(bot_script_hash), 0),
      ],
      extra_signatories: [],
    }

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    WithdrawScriptSigner { script_hash: bot_script_hash },
    TogglePool,
    controller_credential,
    tx,
  )
}

test test_toggle_pool_rejects_mint_script_authorization() fail {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_script_hash = mock_script_hash(4)
  let controller_credential = mock_script_credential(5)
  let pool_input = test_pool_input(pool_hash, test_pool_datum(True))
  let pool_output = test_pool_output(pool_input, test_pool_datum(False))
  let tx =
    test_toggle_transaction(
      pool_input,
      pool_output,
      controller_credential,
      mock_pub_key_hash(4),
    )

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    MintScriptSigner { script_hash: bot_script_hash },
    TogglePool,
    controller_credential,
    tx,
  )
}

test test_toggle_pool_without_bot_signature() fail {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_key_hash = mock_pub_key_hash(4)
  let controller_credential = mock_script_credential(5)
  let pool_input = test_pool_input(pool_hash, test_pool_datum(True))
  let pool_output = test_pool_output(pool_input, test_pool_datum(False))
  let tx =
    Transaction {
      ..test_toggle_transaction(
        pool_input,
        pool_output,
        controller_credential,
        bot_key_hash,
      ),
      extra_signatories: [],
    }

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    VerificationKeySigner { verification_key_hash: bot_key_hash },
    TogglePool,
    controller_credential,
    tx,
  )
}

test test_toggle_pool_cannot_remove_lovelace() fail {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_key_hash = mock_pub_key_hash(4)
  let controller_credential = mock_script_credential(5)
  let pool_input = test_pool_input(pool_hash, test_pool_datum(True))
  let correct_pool_output = test_pool_output(pool_input, test_pool_datum(False))
  let pool_output =
    Output {
      ..correct_pool_output,
      value: assets.merge(
        from_lovelace(test_min_pool_lovelace),
        from_asset(pool_hash, "pool nft", 1),
      ),
    }
  let tx =
    test_toggle_transaction(
      pool_input,
      pool_output,
      controller_credential,
      bot_key_hash,
    )

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    VerificationKeySigner { verification_key_hash: bot_key_hash },
    TogglePool,
    controller_credential,
    tx,
  )
}

test test_toggle_pool_cannot_change_accounting() fail {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_key_hash = mock_pub_key_hash(4)
  let controller_credential = mock_script_credential(5)
  let input_datum = test_pool_datum(True)
  let pool_input = test_pool_input(pool_hash, input_datum)
  let output_datum = PoolDatum { ..test_pool_datum(False), total_underlying: 1 }
  let pool_output = test_pool_output(pool_input, output_datum)
  let tx =
    test_toggle_transaction(
      pool_input,
      pool_output,
      controller_credential,
      bot_key_hash,
    )

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    VerificationKeySigner { verification_key_hash: bot_key_hash },
    TogglePool,
    controller_credential,
    tx,
  )
}

test test_toggle_pool_cannot_authorize_another_script() fail {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_key_hash = mock_pub_key_hash(4)
  let controller_credential = mock_script_credential(5)
  let pool_input = test_pool_input(pool_hash, test_pool_datum(True))
  let pool_output = test_pool_output(pool_input, test_pool_datum(False))
  let other_script_input =
    Input {
      output_reference: mock_utxo_ref(0, 6),
      output: Output {
        address: mock_script_address(6, None),
        value: from_lovelace(2_000_000),
        datum: InlineDatum(0),
        reference_script: None,
      },
    }
  let tx =
    Transaction {
      ..test_toggle_transaction(
        pool_input,
        pool_output,
        controller_credential,
        bot_key_hash,
      ),
      inputs: [pool_input, other_script_input],
    }

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    VerificationKeySigner { verification_key_hash: bot_key_hash },
    TogglePool,
    controller_credential,
    tx,
  )
}

test test_toggle_pool_cannot_mint() fail {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_key_hash = mock_pub_key_hash(4)
  let controller_credential = mock_script_credential(5)
  let pool_input = test_pool_input(pool_hash, test_pool_datum(True))
  let pool_output = test_pool_output(pool_input, test_pool_datum(False))
  let tx =
    Transaction {
      ..test_toggle_transaction(
        pool_input,
        pool_output,
        controller_credential,
        bot_key_hash,
      ),
      mint: from_asset(mock_script_hash(7), "test", 1),
    }

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    VerificationKeySigner { verification_key_hash: bot_key_hash },
    TogglePool,
    controller_credential,
    tx,
  )
}

test test_full_admin() {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_key_hash = mock_pub_key_hash(4)
  let controller_credential = mock_script_credential(5)
  let multisig_input =
    Input {
      output_reference: mock_utxo_ref(0, 3),
      output: Output {
        address: mock_script_address(3, None),
        value: from_lovelace(2_000_000),
        datum: InlineDatum(0),
        reference_script: None,
      },
    }
  let tx = Transaction { ..placeholder, inputs: [multisig_input] }

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    VerificationKeySigner { verification_key_hash: bot_key_hash },
    FullAdmin,
    controller_credential,
    tx,
  )
}

test test_full_admin_with_verification_key() {
  let pool_hash = mock_script_hash(2)
  let admin_key_hash = mock_pub_key_hash(3)
  let controller_credential = mock_script_credential(5)
  let tx =
    Transaction { ..placeholder, extra_signatories: [admin_key_hash] }

  admin_controller.withdraw(
    pool_hash,
    VerificationKeySigner { verification_key_hash: admin_key_hash },
    VerificationKeySigner { verification_key_hash: mock_pub_key_hash(4) },
    FullAdmin,
    controller_credential,
    tx,
  )
}

test test_full_admin_with_withdraw_script() {
  let pool_hash = mock_script_hash(2)
  let admin_script_hash = mock_script_hash(3)
  let controller_credential = mock_script_credential(5)
  let tx =
    Transaction {
      ..placeholder,
      withdrawals: [
        Pair(controller_credential, 0),
        Pair(Script(admin_script_hash), 0),
      ],
    }

  admin_controller.withdraw(
    pool_hash,
    WithdrawScriptSigner { script_hash: admin_script_hash },
    VerificationKeySigner { verification_key_hash: mock_pub_key_hash(4) },
    FullAdmin,
    controller_credential,
    tx,
  )
}

test test_full_admin_with_mint_script() {
  let pool_hash = mock_script_hash(2)
  let admin_script_hash = mock_script_hash(3)
  let controller_credential = mock_script_credential(5)
  let tx =
    Transaction {
      ..placeholder,
      mint: from_asset(admin_script_hash, "admin", 1),
    }

  admin_controller.withdraw(
    pool_hash,
    MintScriptSigner { script_hash: admin_script_hash },
    VerificationKeySigner { verification_key_hash: mock_pub_key_hash(4) },
    FullAdmin,
    controller_credential,
    tx,
  )
}

test test_full_admin_cannot_authorize_itself() fail {
  let pool_hash = mock_script_hash(2)
  let controller_hash = mock_script_hash(5)
  let controller_credential = Script(controller_hash)
  let tx =
    Transaction {
      ..placeholder,
      withdrawals: [Pair(controller_credential, 0)],
    }

  admin_controller.withdraw(
    pool_hash,
    WithdrawScriptSigner { script_hash: controller_hash },
    VerificationKeySigner { verification_key_hash: mock_pub_key_hash(4) },
    FullAdmin,
    controller_credential,
    tx,
  )
}

test test_full_admin_requires_multisig_input() fail {
  let pool_hash = mock_script_hash(2)
  let multisig_hash = mock_script_hash(3)
  let bot_key_hash = mock_pub_key_hash(4)
  let controller_credential = mock_script_credential(5)

  admin_controller.withdraw(
    pool_hash,
    SpendScriptSigner { script_hash: multisig_hash },
    VerificationKeySigner { verification_key_hash: bot_key_hash },
    FullAdmin,
    controller_credential,
    placeholder,
  )
}
