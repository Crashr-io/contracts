import { lucid, readValidator } from "../utils.ts";

const validator = readValidator();
const validator_address = lucid.utils.validatorToAddress(validator);

const txRef = await lucid
  .newTx()
  .payToAddressWithData(
    validator_address,
    { scriptRef: validator },
    {
      lovelace: 50000000n,
    },
  )
  .complete();

const signedTxRef = await txRef.sign().complete();
const txHash = await signedTxRef.submit();
await lucid.awaitTx(txHash);

console.log(`Ref script created at:
    Tx ID: ${txHash}
`);
