use aiken/bytearray
use aiken/dict.{Dict}
use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite, Interval, IntervalBound, PositiveInfinity}
use aiken/list.{foldl}
use aiken/time.{PosixTime}
use aiken/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, ScriptContext, Spend,
  TransactionId, ValidityRange,
}
use aiken/transaction/credential.{
  VerificationKey, VerificationKeyCredential, from_verification_key,
}
use aiken/transaction/value.{from_asset, from_lovelace, lovelace_of}

type MatchParams {
  fighter1: String,
  fighter2: String,
  deadline: PosixTime,
}

type Winner {
  Fighter1
  Fighter2
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

fn after_deadline(range: ValidityRange, deadline: PosixTime) -> Bool {
  when range.lower_bound.bound_type is {
    Finite(tx_earliest_time) -> deadline <= tx_earliest_time
    _ -> False
  }
}

fn split_correctly(
  inputs: List<Input>,
  outputs: List<Output>,
  winner: Winner,
) -> Bool {
  let expected_output = winners_rewards(inputs, winner)
  foldl(
    outputs,
    True,
    fn(output, acc) {
      expect VerificationKeyCredential(output_hash) =
        output.address.payment_credential
      let reward = lovelace_of(output.value)
      expect Some(expected_reward) = dict.get(expected_output, output_hash)
      acc && expected_reward == reward
    },
  )
}

fn winners_bet(inputs: List<Input>, winner: Winner) {
  lovelace_of(
    foldl(
      inputs,
      value.zero(),
      fn(n, acc) {
        expect InlineDatum(bet_inline) = n.output.datum
        expect bet: Winner = bet_inline
        if bet == winner {
          value.merge(n.output.value, acc)
        } else {
          acc
        }
      },
    ),
  )
}

fn winners_rewards(
  inputs: List<Input>,
  winner: Winner,
) -> Dict<Hash<Blake2b_224, VerificationKey>, Int> {
  let total_bet = total_bet(inputs)
  let winners_bet = winners_bet(inputs, winner)
  foldl(
    inputs,
    dict.new(),
    fn(n, acc) {
      expect VerificationKeyCredential(verification_hash) =
        n.output.address.payment_credential
      expect InlineDatum(bet_inline) = n.output.datum
      expect bet: Winner = bet_inline
      if winner == bet {
        dict.insert_with(
          acc,
          verification_hash,
          lovelace_of(n.output.value) * total_bet / winners_bet,
          sum,
          bytearray.compare,
        )
      } else {
        acc
      }
    },
  )
}

fn total_bet(inputs: List<Input>) {
  lovelace_of(
    foldl(inputs, value.zero(), fn(n, acc) { value.merge(n.output.value, acc) }),
  )
}

fn sum(_k, a, b) {
  Some(a + b)
}

// ////////// Testing ////////////////
// /////////Unit Testing ///////
// After Deadline Tests

fn create_interval(tx_earliest_time: PosixTime) -> Interval<PosixTime> {
  let tx_interval: Interval<PosixTime> =
    Interval {
      lower_bound: IntervalBound {
        bound_type: Finite(tx_earliest_time),
        is_inclusive: True,
      },
      upper_bound: IntervalBound {
        bound_type: PositiveInfinity,
        is_inclusive: True,
      },
    }
  tx_interval
}

test when_interval_before_deadline_then_returns_false() {
  let interval = create_interval(50)
  let deadline = 100
  after_deadline(interval, deadline) == False
}

test when_interval_after_deadline_then_returns_true() {
  let interval = create_interval(101)
  let deadline = 100
  after_deadline(interval, deadline) == True
}

// /////////////////////////// Test total_bet function///////////////////////////////////////

fn create_input(quantity: Int, address: ByteArray, winner: Winner) {
  Input {
    output_reference: OutputReference {
      transaction_id: TransactionId { hash: "abcdef" },
      output_index: 1,
    },
    output: Output {
      address: from_verification_key(address),
      value: from_lovelace(quantity),
      datum: InlineDatum(winner),
      reference_script: None,
    },
  }
}

fn create_fake_asset(asset_name: ByteArray, quantity: Int, address: ByteArray) {
  Input {
    output_reference: OutputReference {
      transaction_id: TransactionId { hash: "abcdef" },
      output_index: 1,
    },
    output: Output {
      address: from_verification_key(address),
      value: from_asset(
        policy_id: #"abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
        asset_name: asset_name,
        quantity: quantity,
      ),
      datum: NoDatum,
      reference_script: None,
    },
  }
}

test when_two_plus_two_in_total_bet_then_returns_four() {
  let in1 = create_input(2, "989898", Fighter1)
  let in2 = create_input(2, "898989", Fighter2)
  total_bet([in1, in2]) == 4
}

test when_two_plus_two_and_other_token_in_total_bet_then_returns_four() {
  let in1 = create_input(2, "989898", Fighter1)
  let in2 = create_input(2, "898989", Fighter2)
  let in3 = create_fake_asset("new_token", 2, "3728219")
  total_bet([in1, in2, in3]) == 4
}

test when_input_mulitple_adas_and_calls_winners_bet_then_returns_correct_ammount() {
  let in1 = create_input(2000000, "989898", Fighter1)
  let in2 = create_input(2000000, "898989", Fighter2)
  let in3 = create_input(3000000, "192782", Fighter1)
  let in4 = create_input(4000000, "102847", Fighter2)
  let in5 = create_input(2000000, "182736", Fighter2)
  winners_bet([in1, in2, in3, in4, in5], Fighter2) == 8000000
}

test when_input_mulitple_adas_and_calls_winners_rewards_then_returns_correct_dictionary() {
  let in1 = create_input(2000000, "989898", Fighter1)
  let in2 = create_input(2000000, "898989", Fighter2)
  let in3 = create_input(3000000, "192782", Fighter1)
  let in4 = create_input(4000000, "102847", Fighter2)
  let in5 = create_input(2000000, "182736", Fighter2)
  let winners_rewards = winners_rewards([in1, in2, in3, in4, in5], Fighter1)
  expect Some(ou1) = dict.get(winners_rewards, "989898")
  expect None = dict.get(winners_rewards, "898989")
  expect Some(ou3) = dict.get(winners_rewards, "192782")
  expect None = dict.get(winners_rewards, "102847")
  expect None = dict.get(winners_rewards, "182736")
  ou1 == 5200000 && ou3 == 7800000
}

test when_input_mulitple_adas_and_calls_winners_rewards_then_returns_correct_dictionary2() {
  let in1 = create_input(2000000, "989898", Fighter1)
  let in2 = create_input(2000000, "898989", Fighter2)
  let in3 = create_input(3000000, "192782", Fighter1)
  let in4 = create_input(4000000, "102847", Fighter2)
  let in5 = create_input(2000000, "182736", Fighter2)
  let winners_rewards = winners_rewards([in1, in2, in3, in4, in5], Fighter2)
  expect None = dict.get(winners_rewards, "989898")
  expect Some(ou2) = dict.get(winners_rewards, "898989")
  expect None = dict.get(winners_rewards, "192782")
  expect Some(ou4) = dict.get(winners_rewards, "102847")
  expect Some(ou5) = dict.get(winners_rewards, "182736")
  ou2 == 3250000 && ou4 == 6500000 && ou5 == 3250000
}
