import * as colors from "https://deno.land/std@0.184.0/fmt/colors.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import {
  Blockfrost,
  getAddressDetails,
  Lucid,
  MintingPolicy,
  OutRef,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import {
  acceptOffer,
  batchAcceptOffer,
  cancelOffer,
  createOffer,
  generateRandomAssets,
  updateOffer,
} from "./utils.ts";

console.log(
  colors.yellow(
    "===================================================================================================================================================\n",
  ),
);
const args = Deno.args;
const { SEED_PHRASE, BLOCKFROST_PROJECT_ID, BLOCKFROST_API_URL } = Deno.env
  .toObject();

const funding_lucid = await Lucid.new(
  new Blockfrost(
    BLOCKFROST_API_URL,
    BLOCKFROST_PROJECT_ID,
  ),
  "Preview",
);

const seller_lucid = await Lucid.new(
  new Blockfrost(
    BLOCKFROST_API_URL,
    BLOCKFROST_PROJECT_ID,
  ),
  "Preview",
);

/* Funding Wallet */
const funding_wallet = funding_lucid.selectWalletFromSeed(SEED_PHRASE, {
  accountIndex: 0,
});
const funding_wallet_balance = (await funding_wallet.wallet.getUtxos()).reduce(
  (acc: bigint, curr) => acc + curr.assets["lovelace"],
  BigInt(0),
);
const funding_wallet_address = await funding_wallet.wallet.address();
const funding_wallet_address_details = getAddressDetails(
  funding_wallet_address,
);

console.log(
  colors.yellow(
    `===============================Funding Wallet===============================\n ${
      colors.green("Address: ")
    } ${colors.blue(funding_wallet_address)}\n ${colors.green("Balance: ")} ${
      colors.blue(funding_wallet_balance.toString())
    }\n`,
  ),
);

/* Test NFT/Token Policy */
const minting_policy: MintingPolicy = funding_lucid.utils.nativeScriptFromJson(
  {
    type: "all",
    scripts: [
      {
        type: "sig",
        keyHash: funding_wallet_address_details.paymentCredential?.hash,
      },
    ],
  },
);

const policy_id = funding_lucid.utils.mintingPolicyToId(
  minting_policy,
);

console.log(
  colors.yellow(
    `===============================Minting Policy===============================\n ${
      colors.green("Policy ID: ")
    } ${colors.blue(policy_id)}\n`,
  ),
);

const title = (title: string, description: string) => {
  console.log(
    colors.yellow(
      `===============================${title}===============================\n`,
    ),
    `${colors.green(description)}\n`,
  );
};

/* Wallets */
const seller_wallet = seller_lucid.selectWalletFromSeed(SEED_PHRASE, {
  accountIndex: 1,
});
const seller_pkh = getAddressDetails(await seller_wallet.wallet.address())
  .paymentCredential?.hash;

/* TESTS */

// ADA to Any NFT Trade
// Seller offers to trade 10 ADA for a specific NFT
if (args.includes("--ada-nft") || args.includes("--all")) {
  title("Starting ADA-NFT trade", "Swapping ADA for NFT");

  // Offer 10 ADA
  const offer_amount = new Map();
  offer_amount.set("", new Map([["", 10_000_000n]]));

  // Want to trade for a specific NFT
  const want_amount = new Map();
  want_amount.set(policy_id, new Map([["", 1n]]));

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("ADA-NFT trade successful\n"));
}

// ADA to Multiple Assets
if (args.includes("--ada-multiasset") || args.includes("--all")) {
  title(
    "Starting ADA-Multiple Assets trade",
    "Swapping ADA for Multiple Assets",
  );

  // Offer 10 ADA
  const offer_amount = new Map();
  offer_amount.set("", new Map([["", 10_000_000n]]));

  // Want to trade for more than one NFT
  const want_amount = generateRandomAssets(policy_id, 10);

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("ADA-MultipleAsset trade successful\n"));
}

// ADA to Any Collection NFT
if (args.includes("--ada-anynft") || args.includes("--all")) {
  title(
    "Starting ADA-Any NFT trade",
    "Swapping ADA for Any Asset under a collection",
  );

  // Offer 10 ADA
  const offer_amount = new Map();
  offer_amount.set("", new Map([["", 10_000_000n]]));

  // Want to trade for more than one NFT
  const want_amount = new Map();
  want_amount.set(policy_id, new Map([["", 1n]]));

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("ADA-Any NFT trade successful\n"));
}

// NFT to ADA
if (args.includes("--nft-ada") || args.includes("--all")) {
  title(
    "Starting NFT-ADA trade",
    "Swapping NFT for ADA",
  );

  // Offer 1 NFT
  const offer_amount = generateRandomAssets(policy_id, 1);

  // Trade for 10 ADA
  const want_amount = new Map();
  want_amount.set("", new Map([["", 10_000_000n]]));

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("NFT-ADA trade successful\n"));
}

// NFT to NFT
if (args.includes("--nft-nft") || args.includes("--all")) {
  title(
    "Starting NFT-NFT trade",
    "Swapping NFT for NFT",
  );

  // Offer 1 NFT
  const offer_amount = generateRandomAssets(policy_id, 1);

  // Trade for another NFT
  const want_amount = generateRandomAssets(policy_id, 1);

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("NFT-NFT trade successful\n"));
}

// NFT to Any NFT
if (args.includes("--nft-anynft") || args.includes("--all")) {
  title(
    "Starting NFT-Any NFT trade",
    "Swapping NFT for Any NFT",
  );

  // Offer 1 NFT
  const offer_amount = generateRandomAssets(policy_id, 1);

  // Want to trade for any NFT under a policy ID
  const want_amount = new Map();
  want_amount.set(policy_id, new Map([["", 1n]]));

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("NFT-Any NFT trade successful\n"));
}

// NFT to Any Multiple NFTs
if (args.includes("--nft-anymultinft") || args.includes("--all")) {
  title(
    "Starting NFT-Any Multiple NFT trade",
    "Swapping NFT for Any Multiple NFT",
  );

  // Offer 1 NFT
  const offer_amount = generateRandomAssets(policy_id, 1);

  // Want to trade for more than one NFT under a policy ID
  const want_amount = new Map();
  want_amount.set(policy_id, new Map([["", 5n]]));

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("NFT-Any Multiple NFT trade successful\n"));
}

// NFT to Multiple Assets
if (args.includes("--nft-multiasset") || args.includes("--all")) {
  title(
    "Starting NFT-NFT trade",
    "Swapping NFT for NFT",
  );

  // Offer 1 NFT
  const offer_amount = generateRandomAssets(policy_id, 1);

  // Want to trade for more than one NFT
  const want_amount = generateRandomAssets(policy_id, 6);

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("NFT-Multiple Assets trade successful\n"));
}

// Multiple Assets to ADA
if (args.includes("--multiasset-ada") || args.includes("--all")) {
  title(
    "Starting Multiasset-ADA trade",
    "Swapping Multiple Assets for ADA",
  );

  // Offer multiple assets
  const offer_amount = generateRandomAssets(policy_id, 5);

  // Trade for ADA
  const want_amount = new Map();
  want_amount.set("", new Map([["", 10_000_000n]]));

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("Multiasset-ADA trade successful\n"));
}

// Multiasset to NFT
if (args.includes("--multiasset-nft") || args.includes("--all")) {
  title(
    "Starting Multiasset-NFT trade",
    "Swapping Multiasset for NFT",
  );

  // Offer Multiple Assets
  const offer_amount = generateRandomAssets(policy_id, 5);

  // Trade for 1 NFT
  const want_amount = generateRandomAssets(policy_id, 1);

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("Multiasset-NFT trade successful\n"));
}

// Multiasset to Multiasset
if (args.includes("--multiasset-multiasset") || args.includes("--all")) {
  title(
    "Starting Multiasset-Multiasset trade",
    "Swapping Multiasset for Multiasset",
  );

  // Offer Multiple Assets
  const offer_amount = generateRandomAssets(policy_id, 5);

  // Trade for Multiple Assets
  const want_amount = generateRandomAssets(policy_id, 6);

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("Multiasset-Multiasset trade successful\n"));
}

// Multiasset to Any NFT
if (args.includes("--multiasset-anynft") || args.includes("--all")) {
  title(
    "Starting Multiasset-Any NFT trade",
    "Swapping Multiasset for any NFT",
  );

  // Offer multiple assets
  const offer_amount = generateRandomAssets(policy_id, 5);

  // Want to trade for any NFT under a policy ID
  const want_amount = new Map();
  want_amount.set(policy_id, new Map([["", 1n]]));

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("Multiasset-Any NFT trade successful\n"));
}

// Multiasset to Any Multiasset
if (args.includes("--multiasset-anymultiasset") || args.includes("--all")) {
  title(
    "Starting Multiasset-Any Multiasset trade",
    "Swapping Multiasset for any Multiasset",
  );

  // Offer Multiple Assets
  const offer_amount = generateRandomAssets(policy_id, 5);

  // Want to trade for more than one NFT under a policy ID
  const want_amount = new Map();
  want_amount.set(policy_id, new Map([["", 5n]]));

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  // Buyer accepts the offer
  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);

  console.log(colors.green("Multiasset-Any Multiasset trade successful\n"));
}

if (args.includes("--batch-tx") || args.includes("--all")) {
  title(
    "Starting Batch Transaction",
    "Batching multiple trades into a single transaction",
  );

  const trade_count = 2;
  const outrefs: OutRef[] = [];

  for (let i = 0; i < trade_count; i++) {
    const offer_amount = generateRandomAssets(policy_id, 5);
    const want_amount = generateRandomAssets(policy_id, 5);
    const offer_tx_hash = await createOffer(
      seller_pkh!,
      offer_amount,
      want_amount,
      minting_policy,
      funding_lucid,
    );
    outrefs.push({
      txHash: offer_tx_hash,
      outputIndex: 0,
    });
  }

  // Buyer accepts the offer
  await batchAcceptOffer(outrefs, minting_policy, funding_lucid);

  console.log(colors.green("Batch Transaction successful\n"));
}

if (args.includes("--create-offer")) {
  title(
    "Starting Create Offer Transaction",
    "Creating an offer to trade",
  );

  // Offer 10 ADA
  const offer_amount = new Map();
  offer_amount.set("", new Map([["", 10_000_000n]]));

  // Want to trade for a specific NFT
  const want_amount = new Map();
  want_amount.set(policy_id, new Map([["", 1n]]));

  // Create an offer
  const offer_tx_hash = await createOffer(
    seller_pkh!,
    offer_amount,
    want_amount,
    minting_policy,
    funding_lucid,
  );

  const offer_out_ref: OutRef = {
    txHash: offer_tx_hash,
    outputIndex: 0,
  };

  console.log(colors.green("Offer created successfully\n"));
  console.log({ offer_out_ref });
}

if (args.includes("--cancel")) {
  title(
    "Starting Cancel Transaction",
    "Cancelling a trade",
  );

  const [, tx_hash, output_index] = args;
  const offer_out_ref: OutRef = {
    txHash: tx_hash,
    outputIndex: parseInt(output_index),
  };

  console.log({ offer_out_ref });

  await cancelOffer(
    offer_out_ref,
    await seller_wallet.wallet.address(),
    seller_lucid,
  );
}

if (args.includes("--update-listing")) {
  const [, tx_hash, output_index] = args;
  const out_ref: OutRef = {
    txHash: tx_hash,
    outputIndex: parseInt(output_index),
  };

  // Offer 10 ADA
  const new_offer_amount = new Map();
  new_offer_amount.set("", new Map([["", 15_000_000n]]));

  // Want to trade for a specific NFT
  const new_want_amount = new Map();
  new_want_amount.set(policy_id, new Map([["", 1n]]));

  await updateOffer(
    seller_pkh!,
    new_offer_amount,
    new_want_amount,
    minting_policy,
    out_ref,
    funding_lucid,
    seller_wallet,
  );
}

if (args.includes("--accept-offer")) {
  const [, tx_hash, output_index] = args;
  const offer_out_ref: OutRef = {
    txHash: tx_hash,
    outputIndex: parseInt(output_index),
  };

  await acceptOffer(offer_out_ref, minting_policy, funding_lucid);
}
