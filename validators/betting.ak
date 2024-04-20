use aiken/time.{PosixTime}
use aiken/transaction.{ScriptContext, Spend}
use utils.{Winner, after_deadline, split_correctly}

type MatchParams {
  fighter1: String,
  fighter2: String,
  deadline: PosixTime,
}

validator(match_params: MatchParams) {
  fn betting(_d, winner: Winner, ctx: ScriptContext) {
    when ctx.purpose is {
      Spend(_) ->
        after_deadline(ctx.transaction.validity_range, match_params.deadline)? && split_correctly(
          ctx.transaction.inputs,
          ctx.transaction.outputs,
          winner,
        )
      _ -> False
    }
  }
}
