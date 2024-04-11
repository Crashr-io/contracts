import {
  C,
  Constr,
  Data,
  fromHex,
  toHex,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";
import { buyRedeemer, marketplaceAddr } from "../test.ts";
import { Datum } from "../types.ts";
import { buyer_lucid, lucid, readValidator } from "../utils.ts";

const validator = readValidator();
const validator_address = buyer_lucid.utils.validatorToAddress(validator);
const seller_address = await lucid.wallet.address();
const validator_utxos = await buyer_lucid.provider.getUtxos(validator_address);
const datum = Data.from(validator_utxos[1].datum!, Datum) as Datum;
const seller_output_value: { [key: string]: bigint } = {};

for (const policy of datum.payouts[0].amount.entries()) {
  const [policy_id, assets] = policy;

  for (const asset of assets.entries()) {
    const [asset_name, amount] = asset;

    if (policy_id === "") {
      seller_output_value["lovelace"] = amount;
      continue;
    }
    const unit = policy_id + asset_name;
    seller_output_value[unit] = amount;
  }
}

const datumTag = Data.to(toHex(C.hash_blake2b256(fromHex(Data.to(
  new Constr(0, [new Constr(0, [validator_utxos[1].txHash]), BigInt(0)]),
)))));

const tx = await buyer_lucid
  .newTx()
  .collectFrom([validator_utxos[1]], buyRedeemer(0))
  .readFrom([validator_utxos[0]])
  .payToAddressWithData(
    marketplaceAddr,
    { inline: datumTag },
    {
      lovelace: 16_061_200n,
    },
  )
  .payToAddress(
    seller_address,
    seller_output_value,
  )
  .payToAddress(
    seller_address,
    {
      lovelace: 1_000_000n,
    },
  )
  .complete();

const signedTx = await tx.sign().complete();
const txHash = await signedTx.submit();
await buyer_lucid.awaitTx(txHash);

console.log(`$Trade offer executed at:
      Tx ID: ${txHash}
      Datum: ${datum}
  `);
