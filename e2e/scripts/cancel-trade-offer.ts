import { Constr, Data } from "https://deno.land/x/lucid@0.10.1/mod.ts";
import { lucid, readValidator } from "../utils.ts";

const validator = readValidator();
const validator_utxos = await lucid.provider.getUtxos(
  lucid.utils.validatorToAddress(validator),
);

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
