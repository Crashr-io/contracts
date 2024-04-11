#import "@preview/showybox:2.0.1": showybox
#import "template.typ": *

#set text(
  font: "Roboto",
  size: 10pt
)
#set page(
  paper: "a3",
)
#set par(
  justify: true,
  leading: 0.52em,
)

#align(center, text(17pt)[
  * Crashr Marketplace Contract *
])
The Crashr Marketplace Contract is a modified version of the original #jpg_store v3 contract, which was developed in Aiken. This adaptation allows for the handling of multiple asset trades in a single transaction.

= Core Features
\
The foundational capabilities of the #jpg_store v3 contract facilitate the locking of NFTs in return for ADA. Building upon this, our contract broadens the scope to encompass trading across a diverse array of assets within the Cardano ecosystem. This enhancement enables the exchange of any asset for another, extending to fungible tokens as well.

*Here's a list of core features:*

#for cf in core_features [
  + #cf
]

= Listing Requirements
\

The process for listing assets under the modified contract remains largely aligned with the practices established by #jpg_store. The notable enhancement is the contract's expanded capability to accommodate multiple assets, broadening the scope of transactions beyond the original single-asset framework.

*The listing requirements are as follows:*

#for lr in listing_requirements [
  + #lr
]

\
#figure(
  listing_transaction,
  caption: [
    Sample _listing transaction_ where the owner locks 4 NFTs and 1.5 ADA in the marketplace validator address with a datum specifying the seller's address and the assets they want to receive in exchange and optional royalty payouts.
  ]
)

\
\
\
\
\
= Buying Requirements
\
To successfully complete a transaction, *buyers* are required to transfer the assets specified by the *seller* to the seller's address. The contract also requires buyers to send a *2% fee* to the marketplace, based on the total of the *seller's payout* plus any *royalty fees*. The 2% fee applies to *ADA* (2% or 1 ADA, whichever is higher) and to *fungible tokens transactions* that reach the threshold of *100 tokens*.

Given the contract's capability for *multiple asset trades*, there are instances where only minimal ADA is required. To accommodate this, the contract has been adjusted to include a *unique token fee*. The unique token fee necessitates buyers to send *1 ADA for each unique asset* requested by the seller. This fee also applies to *fungible token transactions* that involve quantities below the *100-token threshold*.

*The buying requirements are as follows:*

#for br in buying_requirements [
  + #br
]

\

#figure(
  buying_transaction,
  caption: [
    Sample _buying transaction_ where the buyer satisfies the seller's requirements by sending the requested assets to the sender's address, the buyer must also satisfy royalty payout requirements if applicable and send the 2% fee + 1 ADA for each unique asset requested. Minimum marketplace fee is 1 ada.
  ]
)

\
\
\
\
\
\
\
= Cancel or Update a Listing Requirements
\
The contract enables the listing owner to cancel or update their listing, retaining the same process as established by the #jpg_store contract. The only requirement for these operations is the owner's signature on the transaction.

\

#figure(
  cancel_transaction,
  caption: [
    Sample _cancel transaction_ where the owner cancels the listing and retrieves the locked assets.
  ]
)

\
\
\
\
= Additional Notes
\

The seller has the option to request a non-specific asset from a particular collection. To do this, within the value property of the payout, the seller needs only to provide the policy ID. The buyer can fulfill this request by sending any asset that falls under the given policy ID. Furthermore, the seller is able to request any quantity of assets under a policy ID without needing to name the specific assets. This functionality aligns with the collection offer feature of the #jpg_store contract.