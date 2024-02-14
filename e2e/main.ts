import {
  C,
  Constr,
  Data,
  fromHex,
  toHex,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";
import {
  BULK_PURCHASE_SIZE,
  bulkPurchaseAssets,
  buyRedeemer,
  makePayout,
  marketplaceAddr,
  singleAsset,
  test,
  testFail,
} from "./test.ts";

const price = 5000000n;

test("Withdraw ask (best case scenario)", async (ctx) => {
  ctx.lucid.selectWalletFromPrivateKey(ctx.sellerPk);

  const seller_output_value: Map<string, Map<string, bigint>> = new Map();
  seller_output_value.set("", new Map());
  seller_output_value.get("")?.set(
    "",
    price - 2000000n,
  );

  const royalty_output_value: Map<string, Map<string, bigint>> = new Map();
  royalty_output_value.set("", new Map());
  royalty_output_value.get("")?.set(
    "",
    1000000n,
  );

  // const datum = Data.to(
  //   new Constr(0, [
  //     [
  //       makePayout(ctx.sellerPaymentCredential?.hash!, price - 2000000n),
  //       makePayout(ctx.royaltyPaymentCredential?.hash!, 1000000n),
  //     ],
  //     ctx.sellerPaymentCredential?.hash!,
  //   ]),
  // );

  const datum = makePayout(ctx.sellerPaymentCredential?.hash!, [{
    address: {
      payment_credential: {
        pkh: ctx.sellerPaymentCredential?.hash!,
      },
      stake_credential: null,
    },
    amount: seller_output_value,
  }, {
    address: {
      payment_credential: {
        pkh: ctx.royaltyPaymentCredential?.hash!,
      },
      stake_credential: null,
    },
    amount: royalty_output_value,
  }]);

  // first tx -- list
  const tx = await ctx.lucid
    .newTx()
    .payToContract(ctx.contractAddress, { asHash: datum }, singleAsset)
    .complete();

  const signed = await tx.sign().complete();

  await signed.submit();

  ctx.emulator.awaitBlock(4);

  // second tx -- cancel
  const contractUtxos = await ctx.lucid.utxosAt(ctx.contractAddress);

  const refUtxos = await ctx.lucid.utxosAt(ctx.refAddr);

  const tx2 = await ctx.lucid
    .newTx()
    .collectFrom(contractUtxos, Data.to(new Constr(1, [])))
    .readFrom(refUtxos)
    .addSigner(ctx.sellerAddr)
    .complete();

  const signed2 = await tx2.sign().complete();

  ctx.emulator.awaitBlock(8);

  return signed2;
});

test("Purchase (best case scenario)", async (ctx) => {
  ctx.lucid.selectWalletFromPrivateKey(ctx.sellerPk);

  const seller_output_value: Map<string, Map<string, bigint>> = new Map();
  seller_output_value.set("", new Map());
  seller_output_value.get("")?.set(
    "",
    price - 2000000n,
  );

  const royalty_output_value: Map<string, Map<string, bigint>> = new Map();
  royalty_output_value.set("", new Map());
  royalty_output_value.get("")?.set(
    "",
    1000000n,
  );

  // const datum = Data.to(
  //   new Constr(0, [
  //     [
  //       makePayout(ctx.sellerPaymentCredential?.hash!, price - 2000000n),
  //       makePayout(ctx.royaltyPaymentCredential?.hash!, 1000000n),
  //     ],
  //     ctx.sellerPaymentCredential?.hash!,
  //   ]),
  // );

  const datum = makePayout(ctx.sellerPaymentCredential?.hash!, [{
    address: {
      payment_credential: {
        pkh: ctx.sellerPaymentCredential?.hash!,
      },
      stake_credential: null,
    },
    amount: seller_output_value,
  }, {
    address: {
      payment_credential: {
        pkh: ctx.royaltyPaymentCredential?.hash!,
      },
      stake_credential: null,
    },
    amount: royalty_output_value,
  }]);

  // first tx -- list
  const tx = await ctx.lucid
    .newTx()
    .payToContract(ctx.contractAddress, { asHash: datum }, singleAsset)
    .complete();

  const signed = await tx.sign().complete();

  await signed.submit();

  ctx.emulator.awaitBlock(4);

  ctx.lucid.selectWalletFromPrivateKey(ctx.buyerPk);

  const datumTag = Data.to(toHex(C.hash_blake2b256(fromHex(Data.to(
    new Constr(0, [new Constr(0, [tx.toHash()]), BigInt(0)]),
  )))));

  const contractUtxos = await ctx.lucid.utxosAt(ctx.contractAddress);

  const refUtxos = await ctx.lucid.utxosAt(ctx.refAddr);

  const tx3 = await ctx.lucid
    .newTx()
    .collectFrom(contractUtxos, buyRedeemer(0))
    .readFrom(refUtxos)
    .payToAddressWithData(
      marketplaceAddr,
      { inline: datumTag },
      {
        lovelace: 1000000n,
      },
    )
    .payToAddress(
      ctx.sellerAddr,
      {
        lovelace: 3000000n,
      },
    )
    .payToAddress(
      ctx.royaltyAddr,
      {
        lovelace: 1000000n,
      },
    )
    .addSigner(ctx.buyerAddr)
    .complete();

  const signed3 = await tx3.sign().complete();

  return signed3;
});

// Simulate a bulk purchase
// fourth tx -- buy 43 nfts that have royalties
test("Bulk purchase (worst case scenario)", async (ctx) => {
  ctx.lucid.selectWalletFromPrivateKey(ctx.sellerPk);

  let bulkLockTx = ctx.lucid.newTx();

  // Lock all the assets in different utxos
  for (const [unit, qty] of Object.entries(bulkPurchaseAssets)) {
    // 100 ADA each
    const myPrice = 100000000n;

    const seller_output_value = new Map();
    seller_output_value.set("", new Map());
    seller_output_value.get("")?.set(
      "",
      myPrice - 4000000n,
    );

    const royalty_output_value = new Map();
    royalty_output_value.set("", new Map());
    royalty_output_value.get("")?.set(
      "",
      2000000n,
    );

    // const datum = Data.to(
    //   new Constr(0, [
    //     [
    //       makePayout(ctx.sellerPaymentCredential?.hash!, myPrice - 4000000n),
    //       makePayout(ctx.royaltyPaymentCredential?.hash!, 2000000n),
    //     ],
    //     ctx.sellerPaymentCredential?.hash!,
    //   ]),
    // );

    const datum = makePayout(ctx.sellerPaymentCredential?.hash!, [{
      address: {
        payment_credential: {
          pkh: ctx.sellerPaymentCredential?.hash!,
        },
        stake_credential: null,
      },
      amount: seller_output_value,
    }, {
      address: {
        payment_credential: {
          pkh: ctx.royaltyPaymentCredential?.hash!,
        },
        stake_credential: null,
      },
      amount: royalty_output_value,
    }]);

    bulkLockTx = bulkLockTx.payToContract(
      ctx.contractAddress,
      { inline: datum },
      {
        [unit]: qty,
      },
    );
  }

  const bulkLockComplete = await bulkLockTx.complete();
  const bulkLockSigned = await bulkLockComplete.sign().complete();

  await bulkLockSigned.submit();

  ctx.emulator.awaitBlock(18);

  const contractUtxos2 = await ctx.lucid.utxosAt(ctx.contractAddress);

  const refUtxos = await ctx.lucid.utxosAt(ctx.refAddr);

  ctx.lucid.selectWalletFromPrivateKey(ctx.buyerPk);

  let bulkPurchaseTx = contractUtxos2
    .filter((u) => u.txHash === bulkLockSigned.toHash())
    .map((utxo, index) => {
      return ctx.lucid
        .newTx()
        .collectFrom([utxo], Data.to(new Constr(0, [BigInt(index * 3)])))
        .readFrom(refUtxos)
        .addSigner(ctx.buyerAddr);
    })
    .reduce((acc, mappedTx) => {
      return acc.compose(mappedTx);
    }, ctx.lucid.newTx());

  for (let i = 0; i < BULK_PURCHASE_SIZE; i++) {
    const oIndex = contractUtxos2[i].outputIndex;
    const datumTag = Data.to(toHex(C.hash_blake2b256(fromHex(Data.to(
      new Constr(0, [new Constr(0, [bulkLockSigned.toHash()]), BigInt(oIndex)]),
    )))));

    bulkPurchaseTx = bulkPurchaseTx
      .payToAddressWithData(
        marketplaceAddr,
        { inline: datumTag },
        {
          lovelace: 2000000n,
        },
      )
      .payToAddress(
        ctx.sellerAddr,
        {
          lovelace: 96000000n,
        },
      )
      .payToAddress(
        ctx.royaltyAddr,
        {
          lovelace: 2000000n,
        },
      );
  }

  const completed = await bulkPurchaseTx.complete();
  const signed4 = await completed.sign().complete();

  return signed4;
});

testFail("Purchase Fail (fee too low)", async (ctx) => {
  ctx.lucid.selectWalletFromPrivateKey(ctx.sellerPk);

  // const datum = Data.to(
  //   new Constr(0, [
  //     [
  //       makePayout(ctx.sellerPaymentCredential?.hash!, 97_000_000n),
  //       makePayout(ctx.royaltyPaymentCredential?.hash!, 1_000_000n),
  //     ],
  //     ctx.sellerPaymentCredential?.hash!,
  //   ]),
  // );

  const seller_output_value: Map<string, Map<string, bigint>> = new Map();
  seller_output_value.set("", new Map());
  seller_output_value.get("")?.set(
    "",
    97_000_000n,
  );

  const royalty_output_value: Map<string, Map<string, bigint>> = new Map();
  royalty_output_value.set("", new Map());
  royalty_output_value.get("")?.set(
    "",
    1_000_000n,
  );

  const datum = makePayout(ctx.sellerPaymentCredential?.hash!, [{
    address: {
      payment_credential: {
        pkh: ctx.sellerPaymentCredential?.hash!,
      },
      stake_credential: null,
    },
    amount: seller_output_value,
  }, {
    address: {
      payment_credential: {
        pkh: ctx.royaltyPaymentCredential?.hash!,
      },
      stake_credential: null,
    },
    amount: royalty_output_value,
  }]);

  // first tx -- list
  const tx = await ctx.lucid
    .newTx()
    .payToContract(ctx.contractAddress, { asHash: datum }, singleAsset)
    .complete();

  const signed = await tx.sign().complete();

  await signed.submit();

  ctx.emulator.awaitBlock(4);

  ctx.lucid.selectWalletFromPrivateKey(ctx.buyerPk);

  const datumTag = Data.to(toHex(C.hash_blake2b256(fromHex(Data.to(
    new Constr(0, [new Constr(0, [tx.toHash()]), BigInt(0)]),
  )))));

  const contractUtxos = await ctx.lucid.utxosAt(ctx.contractAddress);

  const refUtxos = await ctx.lucid.utxosAt(ctx.refAddr);

  const tx3 = await ctx.lucid
    .newTx()
    .collectFrom(contractUtxos, buyRedeemer(0))
    .readFrom(refUtxos)
    .payToAddressWithData(
      marketplaceAddr,
      { inline: datumTag },
      {
        lovelace: 1_000_000n,
      },
    )
    .payToAddress(
      ctx.sellerAddr,
      {
        lovelace: 97_000_000n,
      },
    )
    .payToAddress(
      ctx.royaltyAddr,
      {
        lovelace: 1_000_000n,
      },
    )
    .addSigner(ctx.buyerAddr)
    .complete();

  const signed3 = await tx3.sign().complete();

  return signed3;
});

testFail("Purchase Fail (negative payouts)", async (ctx) => {
  ctx.lucid.selectWalletFromPrivateKey(ctx.sellerPk);

  const seller_output_value: Map<string, Map<string, bigint>> = new Map();
  seller_output_value.set("", new Map());
  seller_output_value.get("")?.set(
    "",
    97_000_000n,
  );

  const royalty_output_value: Map<string, Map<string, bigint>> = new Map();
  royalty_output_value.set("", new Map());
  royalty_output_value.get("")?.set(
    "",
    1_000_000n,
  );

  const negative_royalty_output_value: Map<string, Map<string, bigint>> =
    new Map();
  negative_royalty_output_value.set(
    "",
    new Map(),
  );
  negative_royalty_output_value.get("")?.set(
    "",
    -100_000_000n,
  );

  // const datum = Data.to(
  //   new Constr(0, [
  //     [
  //       makePayout(ctx.sellerPaymentCredential?.hash!, 97_000_000n),
  //       makePayout(ctx.royaltyPaymentCredential?.hash!, 1_000_000n),
  //       makePayout(ctx.royaltyPaymentCredential?.hash!, -100_000_000n),
  //     ],
  //     ctx.sellerPaymentCredential?.hash!,
  //   ]),
  // );

  const datum = makePayout(ctx.sellerPaymentCredential?.hash!, [{
    address: {
      payment_credential: {
        pkh: ctx.sellerPaymentCredential?.hash!,
      },
      stake_credential: null,
    },
    amount: seller_output_value,
  }, {
    address: {
      payment_credential: {
        pkh: ctx.royaltyPaymentCredential?.hash!,
      },
      stake_credential: null,
    },
    amount: royalty_output_value,
  }, {
    address: {
      payment_credential: {
        pkh: ctx.royaltyPaymentCredential?.hash!,
      },
      stake_credential: null,
    },
    amount: negative_royalty_output_value,
  }]);

  // first tx -- list
  const tx = await ctx.lucid
    .newTx()
    .payToContract(ctx.contractAddress, { asHash: datum }, singleAsset)
    .complete();

  const signed = await tx.sign().complete();

  await signed.submit();

  ctx.emulator.awaitBlock(4);

  ctx.lucid.selectWalletFromPrivateKey(ctx.buyerPk);

  const datumTag = Data.to(toHex(C.hash_blake2b256(fromHex(Data.to(
    new Constr(0, [new Constr(0, [tx.toHash()]), BigInt(0)]),
  )))));

  const contractUtxos = await ctx.lucid.utxosAt(ctx.contractAddress);

  const refUtxos = await ctx.lucid.utxosAt(ctx.refAddr);

  const tx3 = await ctx.lucid
    .newTx()
    .collectFrom(contractUtxos, buyRedeemer(0))
    .readFrom(refUtxos)
    .payToAddressWithData(
      marketplaceAddr,
      { inline: datumTag },
      {
        lovelace: 1_000_000n,
      },
    )
    .payToAddress(
      ctx.sellerAddr,
      {
        lovelace: 97_000_000n,
      },
    )
    .payToAddress(
      ctx.royaltyAddr,
      {
        lovelace: 1_000_000n,
      },
    )
    .payToAddress(
      ctx.royaltyAddr,
      {
        lovelace: 1_000_000n,
      },
    )
    .addSigner(ctx.buyerAddr)
    .complete();

  const signed3 = await tx3.sign().complete();

  return signed3;
});
