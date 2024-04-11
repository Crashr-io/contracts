import { Lucid } from "https://deno.land/x/lucid@0.10.1/mod.ts";
import { NETWORK } from "../constants.ts";

const lucid = await Lucid.new(undefined, NETWORK);

const privateKey = lucid.utils.generatePrivateKey();
await Deno.writeTextFile("me.sk", privateKey);

const address = await lucid
  .selectWalletFromPrivateKey(privateKey)
  .wallet.address();
await Deno.writeTextFile("me.addr", address);
