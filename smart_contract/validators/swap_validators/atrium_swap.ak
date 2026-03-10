use aiken/collection/dict
use aiken/collection/list
use cardano/address.{Address, Credential}
use cardano/assets.{PolicyId, lovelace_of, quantity_of}
use cardano/transaction.{NoDatum, Transaction}
use external/constants_e.{atrium_diffusion, stake_pool_an, stake_pool_pid}

validator atrium_swap(atrium_minting_pid: PolicyId, reward_address: Address) {
  withdraw(_redeemer: Void, _account: Credential, tx: Transaction) {
    let Transaction { inputs, outputs, mint, .. } = tx

    // Single input from reward_address holds the atrium_diffusion tokens to burn
    expect [reward_input] =
      list.filter(inputs, fn(input) { input.output.address == reward_address })

    let atrium_amount =
      quantity_of(
        reward_input.output.value,
        atrium_minting_pid,
        atrium_diffusion,
      )

    // Atrium input is identified by holding the StakePool token
    expect [atrium_input] =
      list.filter(
        inputs,
        fn(input) {
          quantity_of(input.output.value, stake_pool_pid, stake_pool_an) > 0
        },
      )

    let atrium_lovelace = lovelace_of(atrium_input.output.value)

    // New atrium output is identified by holding the StakePool token
    expect [new_atrium_output] =
      list.filter(
        outputs,
        fn(output) {
          quantity_of(output.value, stake_pool_pid, stake_pool_an) > 0
        },
      )

    let new_atrium_lovelace = lovelace_of(new_atrium_output.value)

    // All atrium_diffusion tokens must be burnt
    expect [Pair(burn_name, burnt_amount)] =
      mint |> assets.tokens(atrium_minting_pid) |> dict.to_pairs

    // Output to reward_address must carry the lovelace reduction with no datum
    expect [reward_output] =
      list.filter(outputs, fn(output) { output.address == reward_address })

    expect NoDatum = reward_output.datum

    and {
      (burn_name == atrium_diffusion)?,
      (burnt_amount == -atrium_amount)?,
      (lovelace_of(reward_output.value) == atrium_lovelace - new_atrium_lovelace)?,
    }
  }

  else(_) {
    fail
  }
}
