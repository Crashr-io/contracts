import { Constr, Data } from "https://deno.land/x/lucid@0.10.1/mod.ts";
import { lucid, readValidator } from "../utils.ts";

const validator = readValidator();
const buyerAddress =
  "addr_test1vr8x8xt8fqxyqeu54v9dyp0plf5cxxe2up0lwsjw9ulmufq39arum";

const seller_pkh = lucid.utils.getAddressDetails(
  await lucid.wallet.address(),
).paymentCredential?.hash;

const buyer_utxos = await lucid.provider.getUtxos(buyerAddress);
const seller_utxos = await lucid.wallet.getUtxos();
const validator_utxos = await lucid.provider.getUtxos(
  lucid.utils.validatorToAddress(validator),
);

console.log({ validator_utxos });

const tx = await lucid.newTx()
  .collectFrom(validator_utxos, Data.to(new Constr(1, [])))
  .attachSpendingValidator(validator)
  .addSigner(await lucid.wallet.address())
  .complete();

const signedTx = await tx.sign().complete();
const txHash = await signedTx.submit();

await lucid.awaitTx(txHash);

console.log(`$Trade canceled at:
      Tx ID: ${txHash}
  `);
