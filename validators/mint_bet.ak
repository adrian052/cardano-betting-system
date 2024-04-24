use aiken/dict.{to_list}
use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite}
use aiken/list.{filter, find, foldl, has, length, map}
use aiken/time.{PosixTime}
use aiken/transaction.{
  DatumHash, InlineDatum, Input, Mint, NoDatum, ScriptContext, Spend,
  Transaction,
}
use aiken/transaction/credential.{
  Script, ScriptCredential, VerificationKey, from_script,
}
use aiken/transaction/value.{
  AssetName, from_minted_value, lovelace_of, policies, tokens,
}
use utils.{Winner, after_deadline}

type PKH =
  Hash<Blake2b_224, VerificationKey>

type MintDatum {
  winner: Winner,
  bet: Int,
  address: PKH,
}

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
  fn mint_bet(_d: Void, _r: Void, ctx: ScriptContext) {
    when ctx.purpose is {
      Mint(policy_id) -> validate_mint(ctx, policy_id, match_params, token_name)
      Spend(_) ->
        after_deadline(ctx.transaction.validity_range, match_params.deadline)
      _ -> False
    }
  }
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
        let policies = policies(o.value)
        when o.address.payment_credential is {
          ScriptCredential(output_hash) -> {
            expect Some(_) =
              find(policies, fn(policy) { policy == output_hash })
            True
          }
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
