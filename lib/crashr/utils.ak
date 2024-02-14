use aiken/builtin.{tail_list}
use aiken/dict.{Dict}
use aiken/list
use aiken/math
use aiken/transaction.{
  Datum, InlineDatum, NoDatum, Output, OutputReference, TransactionId,
}
use aiken/transaction/credential.{Address, VerificationKeyCredential}
use aiken/transaction/value.{Value, ada_policy_id}
use crashr/constants.{
  marketplace_addr, min_payout, token_fee_lovelace, token_fee_threshold,
}
use crashr/types.{Payout}

/// Checks whether the output covers the payout. 
/// If any asset in the payout is not covered by the output,
/// this function will return `False`.
pub fn does_output_cover_payout(payout_value: Value, output_value: Value) {
  let payout_dict = payout_value |> value.to_dict()
  let output_dict = output_value |> value.to_dict()

  // Compare values
  payout_dict
    |> dict.foldl(
         True,
         fn(policy_id, payout_assets, res) {
           // Compare each asset under this policy_id
           expect Some(output_assets) = output_dict |> dict.get(policy_id)

           payout_assets
             |> dict.foldl(
                  True,
                  fn(asset_name, payout_amount, _) {
                    when output_assets |> dict.get(asset_name) is {
                      // If the asset is found in the output, check if the amount is enough
                      Some(output_amount) ->
                        res && output_amount >= payout_amount
                      // Otherwise check if there are additional assets that can cover
                      // the payout amount if asset is not ada
                      None ->
                        if asset_name != "" || policy_id == ada_policy_id {
                          res && False
                        } else {
                          // count all additional assets                            
                          res && is_additional_assets_covered(
                            payout_assets,
                            output_assets,
                            payout_amount,
                          )
                        }
                    }
                  },
                )
         },
       )
}

/// Helper function for checking if additional assets
/// are included in the output. This is for offers that
/// did not specify a specific asset name.
pub fn is_additional_assets_covered(
  payout_assets: Dict<ByteArray, Int>,
  output_assets: Dict<ByteArray, Int>,
  amount_to_cover: Int,
) {
  let requested_assets =
    payout_assets
      |> dict.keys()
      |> list.filter(fn(asset_name) { asset_name != "" })

  let additional_tokens =
    output_assets
      |> dict.keys()
      |> list.count(
           fn(asset_name) {
             let included =
               requested_assets
                 |> list.has(asset_name)
             !included
           },
         )
  additional_tokens >= amount_to_cover
}

test check_does_output_cover_payout() {
  let value1 =
    value.from_lovelace(100) |> value.merge(value.from_asset("111", "1", 100))
  let value2 =
    value.from_lovelace(101) |> value.merge(value.from_asset("111", "1", 100))
  does_output_cover_payout(value1, value2)
}

test check_does_output_cover_payout_for_non_specific_assets() {
  let value1 =
    value.from_lovelace(1000)
      |> value.merge(value.from_asset("111", "", 3))
      |> value.merge(value.from_asset("111", "1", 1))
  let value2 =
    value.from_lovelace(1000)
      |> value.merge(value.from_asset("111", "1", 1))
      |> value.merge(value.from_asset("111", "2", 1))
      |> value.merge(value.from_asset("111", "3", 1))
      |> value.merge(value.from_asset("111", "4", 1))
  does_output_cover_payout(value1, value2)
}

test check_does_output_not_cover_payout_for_non_specific_assets() fail {
  let value1 =
    value.from_lovelace(1000)
      |> value.merge(value.from_asset("111", "", 3))
      |> value.merge(value.from_asset("111", "1", 1))
  let value2 =
    value.from_lovelace(1000)
      |> value.merge(value.from_asset("111", "2", 1))
      |> value.merge(value.from_asset("111", "3", 1))
      |> value.merge(value.from_asset("111", "4", 1))
      |> value.merge(value.from_asset("111", "5", 1))
      |> value.merge(value.from_asset("111", "6", 1))
      |> value.merge(value.from_asset("111", "7", 1))
      |> value.merge(value.from_asset("111", "8", 1))
  does_output_cover_payout(value1, value2)
}

test check_does_output_cover_payout_for_non_specific_assets_excess() {
  let value1 =
    value.from_lovelace(1000)
      |> value.merge(value.from_asset("112", "4", 1))
      |> value.merge(value.from_asset("113", "", 1))
  let value2 =
    value.from_lovelace(1000)
      |> value.merge(value.from_asset("111", "1", 1))
      |> value.merge(value.from_asset("111", "2", 1))
      |> value.merge(value.from_asset("111", "3", 1))
      |> value.merge(value.from_asset("111", "5", 1))
      |> value.merge(value.from_asset("111", "6", 1))
      |> value.merge(value.from_asset("111", "7", 1))
      |> value.merge(value.from_asset("112", "4", 1))
      |> value.merge(value.from_asset("113", "4", 1))
      |> value.merge(value.from_asset("114", "4", 1))
      |> value.merge(value.from_asset("116", "4", 1))
      |> value.merge(value.from_asset("117", "4", 1))
  does_output_cover_payout(value1, value2)
}

/// Find the outputs that match the list of payouts.
/// We use a heuristic function combined with the given 
/// redeemer offset to jump 10 at a time towards first output to validate.
/// This saves a massive amount in budget allowing us to support 40+ inputs.
/// If the wrong offset is given then the script will fail or cost more.
/// The resulting `Output` list may contain more outputs than payouts. But
/// we expect the transaction to NOT have alternating payout outputs and random
/// outputs. This means you cannot construct transactions that have outputs
/// like this: `[payout, random, payout]`. An example of a valid set of outputs
/// would be: `[random, payout, payout, random]`.
/// This is pretty much `list.drop` but optimized for our situation.
pub fn find_payout_outputs(
  outputs: List<a>,
  payout_outputs_offset: Int,
) -> List<a> {
  if payout_outputs_offset >= 10 {
    outputs
      |> skip_10_items
      |> find_payout_outputs(payout_outputs_offset - 10)
  } else {
    do_find_payout_outputs(outputs, payout_outputs_offset)
  }
}

fn do_find_payout_outputs(outputs: List<a>, current_index: Int) -> List<a> {
  if current_index == 0 {
    outputs
  } else {
    outputs
      |> tail_list
      |> do_find_payout_outputs(current_index - 1)
  }
}

test find_payout_outputs_1() {
  find_payout_outputs([1, 2, 3, 4], 2) == [3, 4]
}

test find_payout_outputs_2() {
  find_payout_outputs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 10) == [11]
}

/// Small utility to skip 10 items in a list.
/// Used by `find_payout_outputs`.
fn skip_10_items(some_list: List<a>) -> List<a> {
  some_list
    |> tail_list
    |> tail_list
    |> tail_list
    |> tail_list
    |> tail_list
    |> tail_list
    |> tail_list
    |> tail_list
    |> tail_list
    |> tail_list
}

test skip_10_items_1() {
  skip_10_items([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) == [11]
}

/// Calculates multiasset fees for the marketplace.
/// The fee is 2% of the total ada value + 1 ada per unique token.
/// But if the token exceeds the threshold then the 1 ada token fee is removed
/// and the fee is 2% of the token value is used as fee instead.
pub fn calculate_marketplace_payout(total_payout: Value) -> Value {
  // 2% of the total ada value
  let ada_fee = value.lovelace_of(total_payout) * 50 / 49 / 50

  // Counts the unique tokens that didn't reach the threshold
  let unique_tokens =
    total_payout
      |> value.without_lovelace()
      |> value.flatten()
      |> list.count(
           fn(asset) {
             let (_, _, amount) = asset
             amount < token_fee_threshold
           },
         )

  // 2% ada fee + 1 ada per unique token
  let ada_token_fee = token_fee_lovelace * unique_tokens + ada_fee
  let total_ada_fee = value.from_lovelace(ada_token_fee |> math.max(min_payout))

  // 2% of the total token value for tokens that exceed the threshold
  let total_token_fee =
    total_payout
      |> value.flatten()
      |> list.foldl(
           value.zero(),
           fn(token, total) {
             let (policy_id, asset_name, amount) = token
             if amount >= token_fee_threshold {
               let token_fee = amount * 50 / 49 / 50
               total |> value.add(policy_id, asset_name, token_fee)
             } else {
               total
             }
           },
         )

  // Merge the fees
  total_ada_fee |> value.merge(total_token_fee)
}

/// This function is used only if a discount
/// is not allowed (tx not signed by jpg). The main difference
/// from `check_payouts` is that we make sure the
/// output address matches a hardcoded marketplace address
/// along with confirming that the output value equals
/// the marketplace_fee. In this case there is no `Payout`
/// to compare to.
pub fn check_marketplace_payout(
  output: Output,
  marketplace_fee: Value,
  datum_tag: Datum,
) -> Bool {
  let Output { address: output_address, value, datum, .. } = output
  let datum_check = datum == datum_tag

  // Match hardcoded marketplace address
  let address_check = output_address == marketplace_addr()

  // Output value quantity must equal the marketplace fee
  // this prevents people from not paying a fee by submitting
  // transactions not constructed by Jpg.
  let quantity_check = marketplace_fee |> does_output_cover_payout(value)

  datum_check? && address_check? && quantity_check?
}

/// Test that `check_marketplace_payout` returns `True` when
/// given the correct arguments. That means, an `Output` with
/// an address equal to the hardcoded marketplace address, and
/// a value greater than or equal to the marketplace fee.
test check_marketplace_payout_valid_input() {
  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> builtin.serialise_data
      |> builtin.blake2b_256
      |> InlineDatum

  let output =
    Output {
      address: marketplace_addr(),
      value: value.from_lovelace(2000000),
      datum: datum_tag,
      reference_script: None,
    }

  check_marketplace_payout(output, value.from_lovelace(2000000), datum_tag)
}

/// This test makes sure that the marketplace payout
/// output address is the hardcoded marketplace address.
/// If the output address does not match the marketplace address
/// `check_marketplace_payout` will return `False`.
test check_marketplace_payout_invalid_address() {
  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> builtin.serialise_data
      |> builtin.blake2b_256
      |> InlineDatum

  let output =
    Output {
      // anything but the marketplace address
      address: Address {
        payment_credential: VerificationKeyCredential(
          #"fff60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
        ),
        stake_credential: None,
      },
      value: value.from_lovelace(2000000),
      datum: datum_tag,
      reference_script: None,
    }

  !check_marketplace_payout(output, value.from_lovelace(2000000), datum_tag)
}

/// This test makes sure that the marketplace payout
/// output value is greater than or equal to the marketplace fee.
/// If the value at the ouput is less than the marketplace fee
/// in the datum `check_marketplace_payout` will return `False`.
test check_marketplace_payout_incorrect_amount() {
  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> builtin.serialise_data
      |> builtin.blake2b_256
      |> InlineDatum

  let output =
    Output {
      // anything but the marketplace address
      address: marketplace_addr(),
      value: value.from_lovelace(1000000),
      datum: datum_tag,
      reference_script: None,
    }

  !check_marketplace_payout(output, value.from_lovelace(2000000), datum_tag)
}

/// Check that payouts and payout outputs
/// are correct. Payouts are stored in the datum
/// when assets are listed. On buy a transaction
/// with matching payout outputs needs to be constructed.
/// We also require that outputs are in the same order as the
/// payouts in the datum. Returns the sum of the payout amounts.
pub fn check_payouts(
  outputs: List<Output>,
  payouts: List<Payout>,
  datum_tag: Datum,
) -> Value {
  expect [first_output, ..rest_outputs] = outputs

  let Output { address: output_address, value, datum, .. } = first_output

  trace @"Comparing datum"
  expect datum == datum_tag

  trace @"Fetching payouts"
  expect [payout, ..rest_payouts] = payouts

  let Payout { address: payout_address, amount } = payout

  // The `Output` address must match
  // the address specified in the corresponding
  // payout from the datum.
  trace @"Comparing addresses"
  expect payout_address == output_address
  let lovelace_amount = value |> value.lovelace_of()
  let lovelace_payout_amount = amount |> value.lovelace_of()
  let is_payout_gte = amount |> does_output_cover_payout(value)

  trace @"Checking if payout is covered"
  expect is_payout_gte && lovelace_amount > 0 && lovelace_payout_amount > 0

  trace @"Checking if there are more outputs and payouts"
  let rest_payouts_amount =
    when rest_payouts is {
      // the base case
      [] ->
        // if rest is empty we are done
        value.zero()
      _ ->
        // continue with remaining outputs and payouts
        check_payouts_aux(rest_outputs, rest_payouts)
    }

  amount |> value.merge(rest_payouts_amount)
}

pub fn check_payouts_aux(outputs: List<Output>, payouts: List<Payout>) -> Value {
  expect [first_output, ..rest_outputs] = outputs

  let Output { address: output_address, value, datum, .. } = first_output

  expect datum == NoDatum
  expect [payout, ..rest_payouts] = payouts

  let Payout { address: payout_address, amount } = payout

  // The `Output` address must match
  // the address specified in the corresponding
  // payout from the datum.
  expect payout_address == output_address

  let lovelace_amount = value |> value.lovelace_of()
  let lovelace_payout_amount = amount |> value.lovelace_of()
  let is_payout_gte = amount |> does_output_cover_payout(value)
  expect is_payout_gte && lovelace_amount > 0 && lovelace_payout_amount > 0

  let rest_payouts_amount =
    when rest_payouts is {
      // the base case
      [] ->
        // if rest is empty we are done
        value.zero()
      _ ->
        // continue with remaining outputs and payouts
        check_payouts_aux(rest_outputs, rest_payouts)
    }

  amount |> value.merge(rest_payouts_amount)
}

/// This test makes sure the `check_payouts` returns true
/// when give the correct inputs. It is safe to have trailing outputs
/// in the transaction as long as the payouts are correct.
test check_payouts_with_trailing_outputs() {
  let test_royalty_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"80f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_seller_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"90f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_random_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"fff60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_royalty_payouts =
    [
      Payout {
        address: test_royalty_addr,
        amount: value.from_lovelace(3000000),
      },
      Payout {
        address: test_seller_addr,
        amount: value.from_lovelace(95000000),
      },
    ]

  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> builtin.serialise_data
      |> builtin.blake2b_256
      |> InlineDatum

  let out_1 =
    Output {
      address: test_royalty_addr,
      value: value.from_lovelace(3100000),
      datum: datum_tag,
      reference_script: None,
    }

  let out_2 =
    Output {
      address: test_seller_addr,
      value: value.from_lovelace(95000000),
      datum: NoDatum,
      reference_script: None,
    }

  let out_random =
    Output {
      address: test_random_addr,
      value: value.from_lovelace(1000000),
      datum: datum_tag,
      reference_script: None,
    }

  let outputs = list.concat([out_1, out_2], list.repeat(out_random, 100))

  check_payouts(outputs, test_royalty_payouts, datum_tag)
    |> does_output_cover_payout(value.from_lovelace(98000000))
}

/// This test makes sure that `check_payouts` returns `False` when
/// the payout outputs are not sequential. If a random output is in between
/// payout outputs then the transaction was constructed incorrectly.
test check_payouts_with_mixed_outputs() fail {
  let test_royalty_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"80f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_seller_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"90f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_random_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"fff60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_royalty_payouts =
    [
      Payout {
        address: test_royalty_addr,
        amount: value.from_lovelace(3000000),
      },
      Payout {
        address: test_seller_addr,
        amount: value.from_lovelace(95000000),
      },
    ]

  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> builtin.serialise_data
      |> builtin.blake2b_256
      |> InlineDatum

  let out_1 =
    Output {
      address: test_royalty_addr,
      value: value.from_lovelace(3000000),
      datum: datum_tag,
      reference_script: None,
    }

  let out_2 =
    Output {
      address: test_seller_addr,
      value: value.from_lovelace(95000000),
      datum: NoDatum,
      reference_script: None,
    }

  let out_random =
    Output {
      address: test_random_addr,
      value: value.from_lovelace(1000000),
      datum: NoDatum,
      reference_script: None,
    }

  check_payouts([out_1, out_random, out_2], test_royalty_payouts, datum_tag)
    |> does_output_cover_payout(value.from_lovelace(98000000))
}

/// This test checks that the check_payouts function works correctly when
/// when the output list has leading outputs that are not part of the
/// payouts. It should return `False` because we expect the leading outputs
/// to have been filtered out before using this function.
test check_payouts_with_leading_outputs() fail {
  let test_royalty_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"80f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_seller_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"90f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_random_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"fff60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_royalty_payouts =
    [
      Payout {
        address: test_royalty_addr,
        amount: value.from_lovelace(3000000),
      },
      Payout {
        address: test_seller_addr,
        amount: value.from_lovelace(95000000),
      },
    ]

  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> builtin.serialise_data
      |> builtin.blake2b_256
      |> InlineDatum

  let out_1 =
    Output {
      address: test_royalty_addr,
      value: value.from_lovelace(3000000),
      datum: datum_tag,
      reference_script: None,
    }

  let out_2 =
    Output {
      address: test_seller_addr,
      value: value.from_lovelace(95000000),
      datum: NoDatum,
      reference_script: None,
    }

  let out_random =
    Output {
      address: test_random_addr,
      value: value.from_lovelace(1000000),
      datum: NoDatum,
      reference_script: None,
    }

  let outputs = list.concat(list.repeat(out_random, 100), [out_1, out_2])

  check_payouts(outputs, test_royalty_payouts, datum_tag)
    |> does_output_cover_payout(value.from_lovelace(98000000))
}

/// If the payout output value does not match the datum payout amount
/// then `check_payouts` should return `False`.
test check_payouts_with_wrong_amounts() fail {
  let test_royalty_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"80f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_seller_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"90f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_random_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"fff60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_royalty_payouts =
    [
      Payout {
        address: test_royalty_addr,
        amount: value.from_lovelace(3000000),
      },
      Payout {
        address: test_seller_addr,
        amount: value.from_lovelace(95000000),
      },
    ]

  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> builtin.serialise_data
      |> builtin.blake2b_256
      |> InlineDatum

  let out_1 =
    Output {
      address: test_royalty_addr,
      value: value.from_lovelace(3000000),
      datum: datum_tag,
      reference_script: None,
    }

  let out_2 =
    Output {
      address: test_seller_addr,
      value: value.from_lovelace(85000000),
      datum: NoDatum,
      reference_script: None,
    }

  let out_random =
    Output {
      address: test_random_addr,
      value: value.from_lovelace(1000000),
      datum: NoDatum,
      reference_script: None,
    }

  let outputs = list.concat([out_1, out_2], list.repeat(out_random, 100))

  check_payouts(outputs, test_royalty_payouts, datum_tag)
    |> does_output_cover_payout(value.from_lovelace(98000000))
}

/// If the payout output address does not match the datum payout address 
/// then `check_payouts` should return `False`.
test check_payouts_with_wrong_address() fail {
  let test_royalty_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"80f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_seller_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"90f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_random_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"fff60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_royalty_payouts =
    [
      Payout {
        address: test_royalty_addr,
        amount: value.from_lovelace(3000000),
      },
      Payout {
        address: test_seller_addr,
        amount: value.from_lovelace(95000000),
      },
    ]

  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> builtin.serialise_data
      |> builtin.blake2b_256
      |> InlineDatum

  let out_1 =
    Output {
      address: Address {
        payment_credential: VerificationKeyCredential(
          #"fff60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
        ),
        stake_credential: None,
      },
      value: value.from_lovelace(3000000),
      datum: datum_tag,
      reference_script: None,
    }

  let out_2 =
    Output {
      address: test_seller_addr,
      value: value.from_lovelace(95000000),
      datum: NoDatum,
      reference_script: None,
    }

  let out_random =
    Output {
      address: test_random_addr,
      value: value.from_lovelace(1000000),
      datum: datum_tag,
      reference_script: None,
    }

  let outputs = list.concat([out_1, out_2], list.repeat(out_random, 100))

  check_payouts(outputs, test_royalty_payouts, datum_tag)
    |> does_output_cover_payout(value.from_lovelace(98000000))
}

/// Test that things work with a single payout
test check_payouts_with_single_payout() {
  let test_royalty_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"80f60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_random_addr =
    Address {
      payment_credential: VerificationKeyCredential(
        #"fff60f3b5ea7153e0acc7a803e4401d44b8ed1bae1c7baaad1a62a81",
      ),
      stake_credential: None,
    }

  let test_royalty_payouts =
    [
      Payout {
        address: test_royalty_addr,
        amount: value.from_lovelace(3000000),
      },
    ]

  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> builtin.serialise_data
      |> builtin.blake2b_256
      |> InlineDatum

  let out_1 =
    Output {
      address: test_royalty_addr,
      value: value.from_lovelace(3000000),
      datum: datum_tag,
      reference_script: None,
    }

  let out_random =
    Output {
      address: test_random_addr,
      value: value.from_lovelace(1000000),
      datum: NoDatum,
      reference_script: None,
    }

  let outputs = list.concat([out_1], list.repeat(out_random, 100))

  check_payouts(outputs, test_royalty_payouts, datum_tag)
    |> does_output_cover_payout(value.from_lovelace(3000000))
}
