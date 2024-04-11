import {
  Assets,
  assetsToValue,
  toHex,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";
import { makePayout } from "../test.ts";
import { lucid, readValidator } from "../utils.ts";

const validator = readValidator();
const seller_pkh = lucid.utils.getAddressDetails(
  await lucid.wallet.address(),
).paymentCredential?.hash;

const seller_want_assets: Assets = {
  "065270479316f1d92e00f7f9f095ebeaac9d009c878dc35ce36d3404433374": 1n,
  "2f0176cef6017be933aac90a94f9e523a0da8cffccc8b3b9f9639cfe4333745f54656464795f4e6674":
    1n,
  "3f32a3a856faa62b7e73d3472e8a45a51e7db2f526ef9e544520265744455354524f59745f54656464795f4e6674":
    1n,
  "69bbb0a59883d538f5652379af7a428312f6e8fce21d40e2e54855bc4e4b4d52745f54656464795f4e6674":
    1n,
  "6e3fa570bde07f80ab446b2f2fad372279ab4e310c852d1cfa0f598b4d454c44745f54656464795f4e6674":
    1n,
  "73dc195f51cca9567914ea25285c81450f202a1c16be6239112e1e69454d50745f54656464795f4e6674":
    1n,
  "80ed3037af4cc98fec3574523dafa05f2359440cfdbef0970e1da69e494e4459745f54656464795f4e6674":
    1n,
  "83345fba84f02f5eb79b2769b9fb8e70d7e94a59ecbde7e9674f7dd74e5458745f54656464795f4e6674":
    1n,
  "89fd8f9252b08c1bb072ff7667ca6a3f4ade27deb5072ae60fda900c53554e444145745f54656464795f4e6674":
    1n,
  "9fcca1128a11911c3c91c0ebdbd6e9938c11a60f0e3fdd73ca0dcdf244494e47745f54656464795f4e6674":
    1n,
  "a035b2b0e71762d04ddb04b2d9471cd414382165dc9db10d418e1c7556594649745f54656464795f4e6674":
    1n,
  "a8fa0499597969a8512558c8fa054bac5232012c297a4f1e13d780e1574d54745f54656464795f4c71":
    1n,
  "adf737598466a0da2d3b7573eca79088a78218375bc581a95a492ed941414441745f54656464795f4e6674":
    1n,
  "c3318fc60568674a1a42a91a6189eace9a6ca5aa70244a2363e05de1575254745f54656464795f4e6674":
    1n,
  "c4dbeaa87ed8a685c26bbac7e05605b71b4c3274465930e5311fa3fc534f4349455459745f54656464795f4e6674":
    1n,
  "cdcafb3717dc0e048aed51a9c2e3756cc40fb48ed2b250fdb656bcb1434c4159745f54656464795f4e6674":
    1n,
};

const seller_offer_assets: Assets = {
  "065270479316f1d92e00f7f9f095ebeaac9d009c878dc35ce36d3404433374": 1n,
  "065270479316f1d92e00f7f9f095ebeaac9d009c878dc35ce36d340447454e5374": 1n,
  "065270479316f1d92e00f7f9f095ebeaac9d009c878dc35ce36d34044745524f74": 1n,
  "065270479316f1d92e00f7f9f095ebeaac9d009c878dc35ce36d34044d454c4474": 1n,
  "065270479316f1d92e00f7f9f095ebeaac9d009c878dc35ce36d3404574d5474": 1n,
  "065270479316f1d92e00f7f9f095ebeaac9d009c878dc35ce36d3404634e45544174": 1n,
  "0733a68164db19ba48f1406df0042c3d542e93d60125927b52da4bdd4d494e745f54656464795f4c71":
    1n,
  "0c3ed3b44074df1dc196dbd2ee61ba5d5a3d1e1e2db4b8636507c32547454e53745f54656464795f4e6674":
    1n,
  "27c970c73aa630f64a914a77e3670a5c019c9e76e88ae0e5752cecac41474958745f54656464795f4e6674":
    1n,
};

const seller_payout_value: Map<string, Map<string, bigint>> = new Map();
seller_payout_value.set("", new Map());
seller_payout_value.get("")?.set(
  "",
  2000000n,
);
const seller_payout_ma = assetsToValue(seller_want_assets).multiasset();

if (seller_payout_ma) {
  const multiAssets = seller_payout_ma.keys();
  for (let j = 0; j < multiAssets.len(); j++) {
    const policy = multiAssets.get(j);
    const policyAssets = seller_payout_ma.get(policy)!;
    const assetNames = policyAssets.keys();
    const policy_id = toHex(policy.to_bytes());
    seller_payout_value.set(policy_id, new Map());

    for (let k = 0; k < assetNames.len(); k++) {
      const policyAsset = assetNames.get(k);
      const quantity = policyAssets.get(policyAsset)!;
      seller_payout_value.get(policy_id)?.set(
        toHex(policyAsset.name()),
        BigInt(quantity.to_str()),
      );
    }
  }
}

const royalty_output_assets: Map<string, Map<string, bigint>> = new Map();
royalty_output_assets.set("", new Map());
royalty_output_assets.get("")?.set(
  "",
  1000000n,
);

const datum = makePayout(seller_pkh!, [{
  address: {
    payment_credential: {
      pkh: seller_pkh!,
    },
    stake_credential: null,
  },
  amount: seller_payout_value,
}, {
  address: {
    payment_credential: {
      pkh: seller_pkh!,
    },
    stake_credential: null,
  },
  amount: royalty_output_assets,
}]);

const tx = await lucid
  .newTx()
  .payToContract(
    lucid.utils.validatorToAddress(validator),
    { inline: datum },
    { lovelace: 19_000_000n, ...seller_offer_assets },
  )
  .complete();

const signedTx = await tx.sign().complete();
const txHash = await signedTx.submit();

await lucid.awaitTx(txHash);

console.log(`$Trade offer created into the contract at:
      Tx ID: ${txHash}
      Datum: ${datum}
  `);
