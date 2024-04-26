use aiken/dict.{to_list}
use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite}
use aiken/list.{filter, has}
use aiken/time.{PosixTime}
use aiken/transaction.{
  DatumHash, InlineDatum, Input, Mint, NoDatum, ScriptContext, Spend,
  Transaction,
}
use aiken/transaction/credential.{Script, ScriptCredential}
use aiken/transaction/value.{
  AssetName, from_minted_value, lovelace_of, policies, tokens,
}
use utils.{MintDatum, after_deadline, get_oracle_datum, split_correctly}

type MatchParams {
  fighter1: String,
  fighter2: String,
  deadline: PosixTime,
}

validator(
  match_params: MatchParams,
  token_name: AssetName,
  oracle_validator: Hash<Blake2b_224, Script>,
) {
  fn mint_bet(_d: Void, minting_hash: ByteArray, ctx: ScriptContext) {
    when ctx.purpose is {
      Mint(policy_id) -> validate_mint(ctx, policy_id, match_params, token_name)
      Spend(_) ->
        validate_spend(
          ctx,
          oracle_validator,
          match_params.deadline,
          minting_hash,
        )
      _ -> False
    }
  }
}

fn validate_spend(
  ctx: ScriptContext,
  oracle_validator: Hash<Blake2b_224, Script>,
  deadline: PosixTime,
  minting_hash: ByteArray,
) {
  expect Some(oracle_winner) =
    get_oracle_datum(ctx.transaction.reference_inputs, oracle_validator)
  let inputs =
    filter(
      ctx.transaction.inputs,
      fn(i) {
        let policies = policies(i.output.value)
        has(policies, minting_hash)
      },
    )
  split_correctly(inputs, ctx.transaction.outputs, oracle_winner) && after_deadline(
    ctx.transaction.validity_range,
    deadline,
  )
}

fn validate_mint(
  ctx: ScriptContext,
  policy_id: ByteArray,
  match_params: MatchParams,
  token_name: AssetName,
) {
  let ScriptContext { transaction: Transaction { mint, .. }, .. } = ctx
  expect [(asset_name, amount)] =
    mint |> from_minted_value |> tokens(policy_id) |> to_list()
  expect [betting_output] =
    list.filter(
      ctx.transaction.outputs,
      fn(o) {
        when o.address.payment_credential is {
          ScriptCredential(_) -> True
          _ -> False
        }
      },
    )
  let is_valid_output_datum =
    when betting_output.datum is {
      NoDatum -> False
      DatumHash(_) -> False
      InlineDatum(d) -> {
        expect datum: MintDatum = d
        let datum_bet = datum.bet
        expect Finite(upper_bound) =
          ctx.transaction.validity_range.upper_bound.bound_type
        let tx_bet = lovelace_of(betting_output.value)
        upper_bound <= match_params.deadline && tx_bet == datum_bet
      }
    }
  is_valid_output_datum && (1 == amount)? && (asset_name == token_name)?
}
