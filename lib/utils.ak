use aiken/bytearray.{concat, from_string}
use aiken/dict.{Dict, foldl}
use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite, Interval, IntervalBound, PositiveInfinity}
use aiken/list as aiken_list
use aiken/string.{from_int}
use aiken/time.{PosixTime}
use aiken/transaction.{
  DatumHash, InlineDatum, Input, NoDatum, Output, OutputReference, TransactionId,
  ValidityRange,
}
use aiken/transaction/credential.{
  Script, ScriptCredential, VerificationKey, VerificationKeyCredential,
  from_verification_key,
}
use aiken/transaction/value.{from_asset, from_lovelace, lovelace_of}

// ////////////////////////Public types and functions////////////////////

pub type PKH =
  Hash<Blake2b_224, VerificationKey>

pub type MintDatum {
  winner: Winner,
  bet: Int,
  address: PKH,
}

pub type Winner {
  Fighter1
  Fighter2
}

pub fn after_deadline(range: ValidityRange, deadline: PosixTime) -> Bool {
  when range.lower_bound.bound_type is {
    Finite(tx_earliest_time) -> deadline <= tx_earliest_time
    _ -> False
  }
}

pub fn before_deadline(range: ValidityRange, deadline: PosixTime) -> Bool {
  when range.upper_bound.bound_type is {
    Finite(tx_latest_time) -> tx_latest_time <= deadline
    _ -> False
  }
}

pub fn split_correctly(
  inputs: List<Input>,
  outputs: List<Output>,
  winner: Winner,
) -> Bool {
  let expected_output = winners_rewards(inputs, winner)
  let actual_outputs = actual_outputs(outputs)
  foldl(
    expected_output,
    True,
    fn(key, value, acc) {
      let concat_output = concat(key, from_string(from_int(value)))
      aiken_list.has(actual_outputs, concat_output) && acc
    },
  )
}

pub fn winners_bet(inputs: List<Input>, winner: Winner) {
  aiken_list.foldl(
    inputs,
    0,
    fn(in, acc) {
      expect InlineDatum(d) = in.output.datum
      expect mint_datum: MintDatum = d
      if mint_datum.winner == winner {
        acc + mint_datum.bet
      } else {
        acc
      }
    },
  )
}

pub fn winners_rewards(
  inputs: List<Input>,
  winner: Winner,
) -> Dict<Hash<Blake2b_224, VerificationKey>, Int> {
  let total_bet_value = total_bet(inputs)
  let winners_bet_value = winners_bet(inputs, winner)
  aiken_list.foldl(
    inputs,
    dict.new(),
    fn(in, acc) {
      expect InlineDatum(d) = in.output.datum
      expect mint_datum: MintDatum = d
      let verification_hash = mint_datum.address
      let winner_datum = mint_datum.winner
      let money = mint_datum.bet
      if winner == winner_datum {
        dict.insert_with(
          acc,
          verification_hash,
          money * total_bet_value * 9 / ( winners_bet_value * 10 ),
          sum,
          bytearray.compare,
        )
      } else {
        acc
      }
    },
  )
}

pub fn actual_outputs(outputs: List<Output>) {
  aiken_list.foldl(
    outputs,
    [],
    fn(out, acc) {
      expect VerificationKeyCredential(pkh) = out.address.payment_credential
      let money = out.value
      aiken_list.push(
        acc,
        concat(pkh, from_string(from_int(lovelace_of(money)))),
      )
    },
  )
}

pub fn total_bet(inputs: List<Input>) -> Int {
  aiken_list.foldl(
    inputs,
    0,
    fn(in, acc) {
      expect InlineDatum(d) = in.output.datum
      expect mint_datum: MintDatum = d
      acc + mint_datum.bet
    },
  )
}

pub fn get_oracle_datum(
  reference_inputs: List<Input>,
  oracle_val: Hash<Blake2b_224, Script>,
) -> Option<Winner> {
  expect [oracle_input] =
    aiken_list.filter(
      reference_inputs,
      fn(i) {
        when i.output.address.payment_credential is {
          ScriptCredential(script_hash) -> script_hash == oracle_val
          _ -> False
        }
      },
    )
  expect oracle_winner: Option<Winner> =
    when oracle_input.output.datum is {
      NoDatum -> fail @"Could not find oracles datum"
      DatumHash(_datum_hash) -> fail @"Oracle's datum must be inlined"
      InlineDatum(datum) -> datum
    }
  oracle_winner
}

pub fn sum(_k, a, b) {
  Some(a + b)
}

// ////////////////////////Testing helper functions////////////////////

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

fn create_output(quantity: Int, address: ByteArray) {
  Output {
    address: from_verification_key(address),
    value: from_lovelace(quantity),
    datum: NoDatum,
    reference_script: None,
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

fn inputs1() -> List<Input> {
  let in1 = create_input(2, "989898", Fighter1)
  let in2 = create_input(2, "898989", Fighter2)
  [in1, in2]
}

fn inputs2() -> List<Input> {
  let in1 = create_input(2, "989898", Fighter1)
  let in2 = create_input(2, "898989", Fighter2)
  let in3 = create_fake_asset("new_token", 2, "3728219")
  [in1, in2, in3]
}

fn inputs3() -> List<Input> {
  let in1 = create_input(2000000, "989898", Fighter1)
  let in2 = create_input(2000000, "898989", Fighter2)
  let in3 = create_input(3000000, "192782", Fighter1)
  let in4 = create_input(4000000, "102847", Fighter2)
  let in5 = create_input(2000000, "182736", Fighter2)
  [in1, in2, in3, in4, in5]
}

// ////////////////////////Unit testing////////////////////

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

test when_two_plus_two_in_total_bet_then_returns_four() {
  total_bet(inputs1()) == 4
}

test when_two_plus_two_and_other_token_in_total_bet_then_returns_four() {
  total_bet(inputs2()) == 4
}

test when_input_multiple_adas_and_calls_winners_bet_then_returns_correct_amount() {
  winners_bet(inputs3(), Fighter2) == 8000000
}

test when_input_multiple_adas_and_calls_winners_rewards_then_returns_correct_dictionary() {
  let winners_rewards = winners_rewards(inputs3(), Fighter1)
  expect Some(ou1) = dict.get(winners_rewards, "989898")
  expect None = dict.get(winners_rewards, "898989")
  expect Some(ou3) = dict.get(winners_rewards, "192782")
  expect None = dict.get(winners_rewards, "102847")
  expect None = dict.get(winners_rewards, "182736")
  ou1 == 5200000 && ou3 == 7800000
}

test when_input_multiple_adas_and_calls_winners_rewards_then_returns_correct_dictionary2() {
  let winners_rewards = winners_rewards(inputs3(), Fighter2)
  expect None = dict.get(winners_rewards, "989898")
  expect Some(ou2) = dict.get(winners_rewards, "898989")
  expect None = dict.get(winners_rewards, "192782")
  expect Some(ou4) = dict.get(winners_rewards, "102847")
  expect Some(ou5) = dict.get(winners_rewards, "182736")
  ou2 == 3250000 && ou4 == 6500000 && ou5 == 3250000
}

test when_input_multiple_adas_and_calls_split_correctly_then_returns_true() {
  let ou1 = create_output(5200000, "989898")
  let ou2 = create_output(7800000, "192782")
  split_correctly(inputs3(), [ou1, ou2], Fighter1)
}

test when_input_multiple_adas_and_calls_split_correctly_then_returns_true2() {
  let ou2 = create_output(3250000, "898989")
  let ou4 = create_output(6500000, "102847")
  let ou5 = create_output(3250000, "182736")
  split_correctly(inputs3(), [ou2, ou4, ou5], Fighter2)
}

test when_input_multiple_adas_and_calls_split_correctly_then_returns_false1() fail {
  let ou2 = create_output(3250000, "898989")
  let ou4 = create_output(6500000, "102847")
  let ou5 = create_output(3250001, "182736")
  split_correctly(inputs3(), [ou2, ou4, ou5], Fighter2)
}

test when_input_multiple_adas_and_calls_split_correctly_then_returns_false2() fail {
  let ou2 = create_output(3250000, "898989")
  let ou4 = create_output(6500000, "102847")
  let ou5 = create_output(3249999, "182736")
  split_correctly(inputs3(), [ou2, ou4, ou5], Fighter2)
}
