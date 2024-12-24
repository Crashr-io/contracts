use aiken/builtin.{blake2b_256, serialise_data}
use aiken/bytearray
use aiken/list
use aiken/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, ScriptContext, Spend,
  Transaction, TransactionId,
}
use aiken/transaction/credential
use aiken/transaction/value
use crashr/constants.{marketplace_addr}
use crashr/types.{Payout, VerificationKeyHash}
use crashr/utils.{
  calculate_marketplace_payout, check_marketplace_payout, check_payouts,
  find_payout_outputs,
}

/// A listing requires a datum that has
/// the owner's payment key and a list of payouts.
/// We do not need to specify the marketplace payout
/// in `payouts` even though it will be in
/// one of the outputs.
type Datum {
  /// Does not contain the marketplace payout.
  /// This is usually royalty and seller payouts.
  payouts: List<Payout>,
  /// Flexible to allow discounts
  /// The key that listed the NFT
  owner: PaymentCredential,
}

/// A user can either buy a token
/// or cancel/update the listing.
type Redeemer {
  /// `payout_outputs_offset` tells us where
  /// the outputs containing the payouts start.
  Buy { payout_outputs_offset: Int }
  /// Cancel or update a listing.
  WithdrawOrUpdate
}

validator {
  /// Validate that the signer is the owner or that payouts
  /// are present as outputs and that the tag is correct.
  fn spend(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = ctx

    let Transaction { outputs, inputs ,  .. } = transaction

    
    // Match on the action.
    when redeemer is {
      Buy { payout_outputs_offset } -> {
        expect Spend(out_ref) = purpose

        // for double satisfaction
        let datum_tag =
          out_ref
            |> serialise_data
            |> blake2b_256
            |> InlineDatum

        let Datum { payouts, .. } = datum

        // Find the `outputs` that correspond to `payouts`.
        let payout_outputs = find_payout_outputs(outputs, payout_outputs_offset)

        expect [marketplace_output, ..rest_outputs] = payout_outputs

        // Calculate total payout
        let payouts_sum = check_payouts(rest_outputs, payouts, NoDatum)

        // Calculate the marketplace fee
        let marketplace_fee = calculate_marketplace_payout(payouts_sum)

        // Make sure that the marketplace output
        // is correct.
        check_marketplace_payout(marketplace_output, marketplace_fee, datum_tag)
      }

      // There's not much to do here. An asset
      // owner can cancel or update their listing
      // at any time.
      WithdrawOrUpdate ->
        // is signed by owner
        list.any(inputs, fn(input) { input.output.address.payment_credential == datum.owner })
      }
  }
}

/// Test swapping ada to NFT only
/// with a single transaction.
test check_asset_to_ada_trade() {
  let seller_address = credential.from_verification_key(#"00000000000001")
  let royalty_address = credential.from_verification_key(#"00000000000002")

  // Assets
  let nft_policy_1 = bytearray.from_string(@"nft_policy_1")
  let nft_1 = bytearray.from_string(@"nft_1")

  let spend_ref: OutputReference =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }

  let spend_input =
    Input {
      output_reference: spend_ref,
      output: Output {
        address: seller_address,
        value: value.from_lovelace(10_000) |> value.add(nft_policy_1, nft_1, 1),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let payouts =
    [
      Payout { address: seller_address, amount: value.from_lovelace(30_000) },
      Payout { address: royalty_address, amount: value.from_lovelace(10_000) },
    ]

  let datum = Datum { payouts, owner: #"00000000000001" }

  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> serialise_data
      |> blake2b_256
      |> InlineDatum

  let seller_output_value = value.from_lovelace(30_000)
  let royalty_output_value = value.from_lovelace(10_000)
  let marketplace_output_value = value.from_lovelace(1_000_000)

  let seller_output =
    Output {
      address: seller_address,
      value: seller_output_value,
      datum: NoDatum,
      reference_script: None,
    }

  let royalty_output =
    Output {
      address: royalty_address,
      value: royalty_output_value,
      datum: NoDatum,
      reference_script: None,
    }

  let marketplace_output =
    Output {
      address: marketplace_addr(),
      value: marketplace_output_value,
      datum: datum_tag,
      reference_script: None,
    }

  let transaction =
    transaction.placeholder()
      |> fn(tx) {
           Transaction {
             ..tx,
             inputs: [spend_input],
             outputs: [marketplace_output, seller_output, royalty_output],
           }
         }

  let context = ScriptContext { purpose: Spend(spend_ref), transaction }
  spend(datum, Buy { payout_outputs_offset: 0 }, context)
}

/// Test swapping multiple assets
/// with a single transaction.
test check_single_asset_to_multiasset_trade() {
  let seller_address = credential.from_verification_key(#"00000000000001")
  let royalty_address = credential.from_verification_key(#"00000000000002")

  // Assets
  let nft_policy_1 = bytearray.from_string(@"nft_policy_1")
  let nft_1 = bytearray.from_string(@"nft_1")
  let nft_policy_2 = bytearray.from_string(@"nft_policy_2")
  let nft_2 = bytearray.from_string(@"nft_2")
  let token_policy_1 = bytearray.from_string(@"token_policy_1")
  let token_1 = bytearray.from_string(@"token_1")

  let spend_ref: OutputReference =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }

  let payouts =
    [
      Payout {
        address: seller_address,
        amount: value.from_lovelace(20_000)
          |> value.add(nft_policy_1, nft_1, 1)
          |> value.add(nft_policy_2, nft_2, 1)
          |> value.add(token_policy_1, token_1, 5_000),
      },
      Payout { address: royalty_address, amount: value.from_lovelace(10_000) },
    ]

  let datum = Datum { payouts, owner: #"00000000000001" }

  let datum_tag =
    OutputReference {
      transaction_id: TransactionId { hash: #"00" },
      output_index: 0,
    }
      |> serialise_data
      |> blake2b_256
      |> InlineDatum

  let seller_output_value =
    value.from_lovelace(20_000)
      |> value.add(nft_policy_1, nft_1, 1)
      |> value.add(nft_policy_2, nft_2, 1)
      |> value.add(token_policy_1, token_1, 5_000)
  let royalty_output_value = value.from_lovelace(10_000)
  let marketplace_output_value =
    value.from_lovelace(2_000_600)
      |> value.merge(value.from_asset(token_policy_1, token_1, 102))

  let seller_output =
    Output {
      address: seller_address,
      value: seller_output_value,
      datum: NoDatum,
      reference_script: None,
    }

  let royalty_output =
    Output {
      address: royalty_address,
      value: royalty_output_value,
      datum: NoDatum,
      reference_script: None,
    }

  let marketplace_output =
    Output {
      address: marketplace_addr(),
      value: marketplace_output_value,
      datum: datum_tag,
      reference_script: None,
    }

  let transaction =
    transaction.placeholder()
      |> fn(tx) {
           Transaction {
             ..tx,
             outputs: [marketplace_output, seller_output, royalty_output],
           }
         }

  let context = ScriptContext { purpose: Spend(spend_ref), transaction }
  spend(datum, Buy { payout_outputs_offset: 0 }, context)
}
