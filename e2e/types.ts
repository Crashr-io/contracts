import { Data } from "https://deno.land/x/lucid@0.10.1/mod.ts";

const DatumSchema = Data.Object({
  payouts: Data.Array(Data.Object({
    address: Data.Object({
      payment_credential: Data.Object({
        pkh: Data.Bytes(),
      }),
      stake_credential: Data.Nullable(Data.Object({
        pkh: Data.Bytes(),
      })),
    }),
    amount: Data.Map(Data.Bytes(), Data.Map(Data.Bytes(), Data.Integer())),
  })),
  owner: Data.Bytes(),
});

const RedeemerSchema = Data.Enum([
  Data.Object({
    Buy: Data.Object({
      payout_outputs_offset: Data.Integer(),
    }),
  }),
  Data.Literal("WithdrawOrUpdate"),
]);

type Datum = Data.Static<typeof DatumSchema>;
type Redeemer = Data.Static<typeof RedeemerSchema>;

const Datum = DatumSchema as unknown as Datum;
const Redeemer = RedeemerSchema as unknown as Redeemer;

export { Datum, Redeemer };
