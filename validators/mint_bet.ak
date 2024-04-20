use aiken/dict.{to_list}
use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite}
use aiken/list
use aiken/time.{PosixTime}
use aiken/transaction.{
  DatumHash, InlineDatum, Mint, NoDatum, OutputReference, ScriptContext,
  Transaction,
}
use aiken/transaction/credential.{ScriptCredential, VerificationKey}
use aiken/transaction/value.{AssetName, from_minted_value, lovelace_of, tokens}
use utils.{Winner}

type PKH =
  Hash<Blake2b_224, VerificationKey>

type MintDatum {
  winner: Winner,
  bet: Int,
  address: PKH,
  posixtime: PosixTime,
}

validator(
  utxo_ref: OutputReference,
  token_name: AssetName,
  betting_address: PKH,
  validator_posixtime: PosixTime,
) {
  fn mint_bet(_r: Void, ctx: ScriptContext) {
    expect Mint(policy_id) = ctx.purpose
    let ScriptContext { transaction: Transaction { inputs, mint, .. }, .. } =
      ctx
    expect [(asset_name, amount)] =
      mint |> from_minted_value |> tokens(policy_id) |> to_list()
    let is_output_consumed =
      list.any(inputs, fn(input) { input.output_reference == utxo_ref })

    expect [betting_output] =
      list.filter(
        ctx.transaction.outputs,
        fn(o) {
          when o.address.payment_credential is {
            ScriptCredential(output_hash) -> betting_address == output_hash
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
          let posixtime = datum.posixtime
          let datum_bet = datum.bet
          expect Finite(upper_bound) =
            ctx.transaction.validity_range.upper_bound.bound_type
          let tx_bet = lovelace_of(betting_output.value)
          posixtime <= upper_bound && upper_bound <= validator_posixtime && tx_bet == datum_bet
        }
      }
    is_valid_output_datum && is_output_consumed? && (1 == amount)? && (asset_name == token_name)?
  }
}
