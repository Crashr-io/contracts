import * as colors from "https://deno.land/std@0.184.0/fmt/colors.ts";
import {
  C,
  Constr,
  Data,
  fromHex,
  Lucid,
  MintingPolicy,
  OutRef,
  toHex,
  Tx,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { buyRedeemer, marketplaceAddr, Payout } from "../test.ts";
import { Datum } from "../types.ts";
import { lucid, readValidator } from "../utils.ts";

const marketplace_pct = 20n;
const token_fee_threshold = 100n;
const unique_token_fee = 1_000_000n;
const min_ada_fee = 1_000_000n;
const validator = readValidator();

const encoder = new TextEncoder();

export function getRandomString(s: number) {
  if (s % 2 == 1) {
    throw new Deno.errors.InvalidData("Only even sizes are supported");
  }
  const buf = new Uint8Array(s / 2);
  crypto.getRandomValues(buf);
  let ret = "";
  for (let i = 0; i < buf.length; ++i) {
    ret += ("0" + buf[i].toString(16)).slice(-2);
  }
  return ret;
}

export function generateRandomAssets(
  policy_id: string,
  count: number,
): Map<string, Map<string, bigint>> {
  const asset_names = Array.from(
    { length: count },
    () => getRandomString(32),
  );
  const asset_names_hex = asset_names.map((asset_name) =>
    toHex(encoder.encode(asset_name))
  );

  const asset_value = new Map();
  asset_names_hex.forEach((asset_name_hex) => {
    // Check if there's already a Map for this policyId
    if (asset_value.has(policy_id)) {
      // If so, retrieve it and add the new asset_name_hex with its amount
      const existingMap = asset_value.get(policy_id);
      existingMap.set(asset_name_hex, 1n);
    } else {
      // Otherwise, create a new Map for this policyId with the asset_name_hex
      asset_value.set(policy_id, new Map([[asset_name_hex, 1n]]));
    }
  });

  return asset_value;
}

export function mappedValueToAssets(
  map: Map<string, Map<string, Amount>>,
): { [key: string]: Amount } {
  const result: { [key: string]: Amount } = {};

  map.forEach((innerMap, outerKey) => {
    innerMap.forEach((amount, innerKey) => {
      if (innerKey === "" && outerKey === "") {
        result["lovelace"] = amount;
        return;
      }

      if (innerKey === "") {
        const random_value = generateRandomAssets(outerKey, Number(amount));
        const random_value_as_assets = mappedValueToAssets(random_value);

        Object.entries(random_value_as_assets).forEach(([key, value]) => {
          result[key] = value;
        });

        return;
      }

      const combinedKey = `${outerKey}${innerKey}`; // Creating the combined key
      result[combinedKey] = amount; // Assigning the amount to the combined key
    });
  });

  return result;
}

export function mappedValueWithoutLovelace(
  map: Map<string, Map<string, bigint>>,
) {
  const result: Map<string, Map<string, bigint>> = new Map(map);
  result.delete("");
  return result;
}

export function mergePayouts(
  payouts: Payout[],
): Map<string, Map<string, bigint>> {
  const resultMap = new Map<string, Map<string, bigint>>();

  // Iterate over each payout
  for (const payout of payouts) {
    // Iterate over each outer map entry
    payout.amount.forEach((innerMap, outerKey) => {
      if (!resultMap.has(outerKey)) {
        // If the outer key doesn't exist, clone the inner map and add it to the result
        resultMap.set(outerKey, new Map(innerMap));
      } else {
        // If the outer key exists, merge the inner maps
        const resultInnerMap = resultMap.get(outerKey)!;
        innerMap.forEach((value, innerKey) => {
          // Add values for matching inner keys, or set the new key-value pair if it doesn't exist
          resultInnerMap.set(
            innerKey,
            (resultInnerMap.get(innerKey) || 0n) + value,
          );
        });
      }
    });
  }

  return resultMap;
}

export function addPayoutOutputs(
  payouts: Payout[],
  minted_assets: Record<string, bigint>,
  tx: Tx,
): Tx {
  for (const payout of payouts) {
    const paymentCredential = payout.address.payment_credential;
    const stakeCredential = payout.address.stake_credential;
    const addr = lucid.utils.credentialToAddress(
      {
        type: "Key",
        hash: paymentCredential.pkh,
      },
      stakeCredential
        ? {
          type: "Key",
          hash: stakeCredential.pkh,
        }
        : undefined,
    );
    const amount = payout.amount;
    const output_assets: Record<string, bigint> = {};

    for (const [policy_id, assets] of amount.entries()) {
      for (const [asset_name, quantity] of assets.entries()) {
        if (policy_id === "" && asset_name === "") {
          output_assets["lovelace"] = quantity;
          continue;
        }

        if (asset_name === "") {
          for (const [key, value] of Object.entries(minted_assets)) {
            output_assets[key] = value;
          }

          continue;
        }

        output_assets[policy_id + asset_name] = quantity;
      }
    }

    tx.payToAddress(addr, output_assets);
  }

  return tx;
}

// Define the types for clarity
type PolicyId = string;
type AssetName = string;
type Amount = bigint; // Using bigint for the amount

// The function to flatten the Map into a list of tuples
function flattenPayout(
  map: Map<PolicyId, Map<AssetName, Amount>>,
): Array<[PolicyId, AssetName, Amount]> {
  const tupleList: Array<[PolicyId, AssetName, Amount]> = [];

  map.forEach((innerMap, policyId) => {
    innerMap.forEach((amount, assetName) => {
      tupleList.push([policyId, assetName, amount]);
    });
  });

  return tupleList;
}

export function addMarketplacePayoutOutput(
  assets: Map<string, Map<string, bigint>>,
  marketplace_address: string,
  datum_tag: string,
  tx: Tx,
): Tx {
  // Get total lovelace fee
  const ada_value = assets.get("")?.get("") || 0n;
  const ada_fee = (ada_value * marketplace_pct + 50n) / 1000n;

  // Get unique tokens
  const flattened_assets = flattenPayout(assets);
  const unique_tokens = flattened_assets.reduce(
    (total: bigint, [policy_id, asset_name, amount]) => {
      if (
        (policy_id === "" && asset_name === "") || amount >= token_fee_threshold
      ) {
        return total + 0n;
      }

      if (asset_name === "") {
        return total + amount;
      }

      return total + 1n;
    },
    0n,
  );

  // Calculate ada + unique token fee
  const ada_token_fee = unique_tokens * unique_token_fee + ada_fee;
  const total_ada_fee = min_ada_fee > ada_token_fee
    ? min_ada_fee
    : ada_token_fee;

  // For fungible tokens with a quantity greater than the threshold, calculate the fee
  const zero_value: {
    [key: string]: bigint;
  } = {};
  const total_token_fee = flattened_assets.reduce(
    (total_value, [policy_id, asset_name, amount]) => {
      if (amount >= token_fee_threshold && policy_id !== "") {
        const token_fee = (amount * marketplace_pct + 50n) / 1000n;
        total_value[policy_id + asset_name] = token_fee;
      }
      return total_value;
    },
    zero_value,
  );

  // Add ada fee to the total token fee
  total_token_fee["lovelace"] = total_ada_fee;

  // Add the payout to the marketplace in the transaction
  tx.payToAddressWithData(
    marketplace_address,
    { inline: datum_tag },
    total_token_fee,
  );

  return tx;
}

export async function createOffer(
  seller_pkh: string,
  offer_amount: Map<string, Map<string, bigint>>,
  want_amount: Map<string, Map<string, bigint>>,
  minting_policy: MintingPolicy,
  wallet: Lucid,
): Promise<string> {
  const validator_address = wallet.utils.validatorToAddress(validator);
  const offer_assets = mappedValueToAssets(offer_amount);
  const payouts: Payout[] = [];

  // seller_payout
  payouts.push({
    address: {
      payment_credential: {
        pkh: seller_pkh!,
      },
      stake_credential: null,
    },
    amount: want_amount,
  });

  const datum: Datum = {
    payouts,
    owner: seller_pkh!,
  };

  const offer_without_lovelace = mappedValueWithoutLovelace(offer_amount);
  const offer_without_lovelace_assets = mappedValueToAssets(
    offer_without_lovelace,
  );

  // Create the offer transaction
  console.log(colors.magenta("Building the offer transaction"));

  const offer_tx = wallet.newTx()
    .payToContract(
      validator_address,
      { inline: Data.to(datum, Datum) },
      offer_assets,
    );

  // Check if there are any assets to mint
  if (offer_without_lovelace.size > 0) {
    offer_tx
      .mintAssets(offer_without_lovelace_assets)
      .attachMintingPolicy(minting_policy);
  }

  // Complete the offer transaction
  const completed_tx = await offer_tx.complete();
  const offer_tx_signed = await completed_tx.sign().complete();

  console.log(colors.magenta("Submitting the offer transaction"));
  const txHash = await offer_tx_signed.submit();

  console.log(
    colors.magenta(
      `Offer transaction submitted at: ${colors.blue(txHash)}`,
    ),
  );

  console.log(colors.magenta("Awaiting confirmation\n\n"));
  await wallet.provider.awaitTx(txHash);

  await (new Promise((resolve) => setTimeout(resolve, 40000)));

  return txHash;
}

export function createOfferTx(
  seller_pkh: string,
  offer_amount: Map<string, Map<string, bigint>>,
  want_amount: Map<string, Map<string, bigint>>,
  minting_policy: MintingPolicy,
  wallet: Lucid,
): Tx {
  const validator_address = wallet.utils.validatorToAddress(validator);
  const offer_assets = mappedValueToAssets(offer_amount);
  const payouts: Payout[] = [];

  // seller_payout
  payouts.push({
    address: {
      payment_credential: {
        pkh: seller_pkh!,
      },
      stake_credential: null,
    },
    amount: want_amount,
  });

  const datum: Datum = {
    payouts,
    owner: seller_pkh!,
  };

  const offer_without_lovelace = mappedValueWithoutLovelace(offer_amount);
  const offer_without_lovelace_assets = mappedValueToAssets(
    offer_without_lovelace,
  );

  // Create the offer transaction
  console.log(colors.magenta("Building the offer transaction"));

  const offer_tx = wallet.newTx()
    .payToContract(
      validator_address,
      { inline: Data.to(datum, Datum) },
      offer_assets,
    );

  // Check if there are any assets to mint
  if (offer_without_lovelace.size > 0) {
    offer_tx
      .mintAssets(offer_without_lovelace_assets)
      .attachMintingPolicy(minting_policy);
  }

  // Complete the offer transaction

  return offer_tx;
}

export async function acceptOffer(
  offer_out_ref: OutRef,
  minting_policy: MintingPolicy,
  wallet: Lucid,
): Promise<string> {
  // Create the accept offer transaction
  console.log(colors.magenta("Building the accept offer transaction"));
  const offer_utxo = await wallet.provider.getUtxosByOutRef([
    offer_out_ref,
  ]);

  // Get the offer datum
  const offer_datum = Data.from(offer_utxo[0].datum!, Datum) as Datum;
  const want_amount = offer_datum.payouts[0].amount;
  const datum_tag = Data.to(toHex(C.hash_blake2b256(fromHex(Data.to(
    new Constr(0, [
      new Constr(0, [offer_out_ref.txHash]),
      BigInt(offer_out_ref.outputIndex),
    ]),
  )))));

  let accept_tx = wallet.newTx()
    .collectFrom(offer_utxo, buyRedeemer(0))
    .attachSpendingValidator(validator);

  const want_assets_without_lovelace = mappedValueWithoutLovelace(want_amount);
  const mint_assets = mappedValueToAssets(want_assets_without_lovelace);

  // Check if there are any assets to mint
  if (want_assets_without_lovelace.size > 0) {
    accept_tx
      .mintAssets(mint_assets)
      .attachMintingPolicy(minting_policy);
  }

  accept_tx = addMarketplacePayoutOutput(
    mergePayouts(offer_datum.payouts),
    marketplaceAddr,
    datum_tag,
    accept_tx,
  );

  accept_tx = addPayoutOutputs(offer_datum.payouts, mint_assets, accept_tx);

  // Complete the accept offer transaction
  const complete_accept_tx = await accept_tx.complete();
  const accept_tx_signed = await complete_accept_tx.sign().complete();

  console.log(colors.magenta("Submitting the accept offer transaction"));
  const accept_tx_hash = await accept_tx_signed.submit();

  console.log(
    colors.magenta(
      `Accept offer transaction submitted at: ${colors.blue(accept_tx_hash)}`,
    ),
  );

  console.log(
    colors.magenta("Awaiting confirmation\n\n"),
  );
  await wallet.provider.awaitTx(accept_tx_hash);

  return accept_tx_hash;
}

export async function batchAcceptOffer(
  offer_out_refs: OutRef[],
  minting_policy: MintingPolicy,
  wallet: Lucid,
): Promise<string> {
  // Create the accept offer transaction
  console.log(colors.magenta("Building the accept offer transaction"));
  const offer_utxos = await wallet.provider.getUtxosByOutRef(
    offer_out_refs,
  );

  let accept_tx = wallet.newTx()
    .attachSpendingValidator(validator);

  let assets_to_mint: {
    [key: string]: Amount;
  } = {};

  let offset = 0;
  for (const offer_utxo of offer_utxos) {
    // Get the offer datum
    const offer_datum = Data.from(offer_utxo.datum!, Datum) as Datum;
    const want_amount = offer_datum.payouts[0].amount;
    const datum_tag = Data.to(toHex(C.hash_blake2b256(fromHex(Data.to(
      new Constr(0, [
        new Constr(0, [offer_utxo.txHash]),
        BigInt(offer_utxo.outputIndex),
      ]),
    )))));

    const want_assets_without_lovelace = mappedValueWithoutLovelace(
      want_amount,
    );

    const mint_assets = mappedValueToAssets(want_assets_without_lovelace);
    assets_to_mint = { ...assets_to_mint, ...mint_assets };

    accept_tx = addMarketplacePayoutOutput(
      mergePayouts(offer_datum.payouts),
      marketplaceAddr,
      datum_tag,
      accept_tx,
    );

    accept_tx = addPayoutOutputs(offer_datum.payouts, mint_assets, accept_tx);
    accept_tx.collectFrom([offer_utxo], buyRedeemer(offset));
    offset += offer_datum.payouts.length + 1;
  }

  // Check if there are any assets to mint
  if (Object.keys(assets_to_mint).length > 0) {
    accept_tx
      .mintAssets(assets_to_mint)
      .attachMintingPolicy(minting_policy);
  }

  // Complete the accept offer transaction
  const complete_accept_tx = await accept_tx.complete();
  const accept_tx_signed = await complete_accept_tx.sign().complete();

  console.log(colors.magenta("Submitting the accept offer transaction"));
  const accept_tx_hash = await accept_tx_signed.submit();

  console.log(
    colors.magenta(
      `Accept offer transaction submitted at: ${colors.blue(accept_tx_hash)}`,
    ),
  );

  console.log(
    colors.magenta("Awaiting confirmation\n\n"),
  );
  await wallet.provider.awaitTx(accept_tx_hash);

  return accept_tx_hash;
}

export async function cancelOffer(
  out_ref: OutRef,
  seller_wallet: string,
  wallet: Lucid,
) {
  const utxo = await wallet.provider.getUtxosByOutRef([out_ref]);

  const cancel_tx = await wallet.newTx()
    .collectFrom(utxo, Data.to(new Constr(1, [])))
    .attachSpendingValidator(validator)
    .addSigner(seller_wallet)
    .complete();

  const cancel_tx_signed = await cancel_tx.sign().complete();
  const cancel_tx_hash = await cancel_tx_signed.submit();

  console.log(
    colors.magenta(
      `Cancel offer transaction submitted at: ${colors.blue(cancel_tx_hash)}`,
    ),
  );

  console.log(
    colors.magenta("Awaiting confirmation\n\n"),
  );
  await wallet.provider.awaitTx(cancel_tx_hash);

  return cancel_tx_hash;
}

export async function updateOffer(
  seller_pkh: string,
  offer_amount: Map<string, Map<string, bigint>>,
  want_amount: Map<string, Map<string, bigint>>,
  minting_policy: MintingPolicy,
  out_ref: OutRef,
  funding_wallet: Lucid,
  seller_wallet: Lucid,
) {
  const utxo = await funding_wallet.provider.getUtxosByOutRef([out_ref]);
  const new_offer_tx = createOfferTx(
    seller_pkh,
    offer_amount,
    want_amount,
    minting_policy,
    seller_wallet,
  );

  // Cancel
  const completed_tx = await new_offer_tx
    .collectFrom(utxo, Data.to(new Constr(1, [])))
    .attachSpendingValidator(validator)
    .addSignerKey(seller_pkh)
    .complete();

  const cancel_tx_signed = await completed_tx.sign().complete();

  console.log(colors.magenta("Submitting the update offer transaction"));
  const txHash = await cancel_tx_signed.submit();

  console.log(
    colors.magenta(
      `Update offer transaction submitted at: ${colors.blue(txHash)}`,
    ),
  );
}
