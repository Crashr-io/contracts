#import "@preview/showybox:2.0.1": showybox

#let jpg_store = link("https://github.com/jpg-store/contracts-v3")[
  *JPG Store*
]

#let core_features = (
[*Trade ADA for NFT:* Enables direct exchange of ADA for NFT assets.],
[*Trade NFT for ADA:* Allows NFT assets to be traded in return for ADA.],
[*Trade Multiple Assets for NFT:* Facilitates the exchange of various assets for a single NFT.],
[*Trade NFT for Multiple Assets:* Permits the trading of a single NFT for multiple different assets.],
[*Trade Multiple Assets for Multiple Assets:* Supports transactions involving the exchange of multiple assets for multiple other assets.],
[*Versatile Trading Combinations:* Empowers users to trade in any combination of the above, including fungible tokens, ensuring flexibility and broad trading possibilities.]
)

#let listing_requirements = (
  [*User* must *send the assets they wish to trade* to the *marketplace contract*.],
  [*User* must *specify the assets he wish to receive in return* in the *output datum* and optional royalty payouts.],
  [For transactions exclusively involving *native assets*, users are required to *lock the minimum ADA* required by the protocol along with the assets.],
  [Optionally, *users can designate a royalty fee* for the *original NFT creator*. This fee, calculated offchain and payable solely in ADA, is based on the NFT's *estimated value at listing*. In cases of trades involving *multiple NFTs from distinct projects*, each project's *royalty address* may be included in the payout, provided the ADA value meets the *minimum requirement of 1 ADA*.]
)

#let buying_requirements = (
  [*Buyer must send the marketplace fee to the marketplace fee address* hardcoded in the contract. It is enforced that the *first payout must be the marketplace fee*; subsequent payouts can be in any order. The marketplace payout also needs to be tagged with the *blake2b256 hash of the spend_tx_out_ref* to prevent double satisfaction.],
  [*The buy redeemer has an offset property*, an optimization from the original JPG Store contract. It indicates the *current payout index being processed on-chain*.],
  [*Buyer must send the assets specified by the seller to the seller's address.*],
  [If a *royalty fee* is specified, the *buyer must send the royalty fee to the original creator of the NFT*. This fee, calculated offchain, is not enforced by the contract but is expected to be in ADA, based on the *estimated price of the assets* at the time of listing.]
)

#let tx_input(title: str, ada: str, assets: str, datum: showybox, redeemer: showybox) = [
  #showybox(
    frame: (
      border-color: blue.darken(50%),
      title-color: blue.lighten(60%),
      body-color: blue.lighten(80%)
    ),
    title-style: (
      color: black,
      weight: "bold",
      align: center
    ),
    shadow: (
      offset: 3pt,
    ),
    title: [#title],
    columns(2)[
      #showybox(
      title-style: (boxed-style: (:)),
      title: "ADA",
      [#ada]
      )
      #colbreak()
      #showybox(
        title-style: (boxed-style: (:)),
        title: "Assets",
        [#assets]
      )
    ],
    footer: datum
  )
]

#let tx_output(title: str, ada: str, assets: str, datum: showybox) = [
  #showybox(
      frame: (
        border-color: blue.darken(50%),
        title-color: blue.lighten(60%),
        body-color: blue.lighten(80%)
      ),
      title-style: (
        color: black,
        weight: "bold",
        align: center
      ),
      shadow: (
        offset: 3pt,
      ),
      title: [#title],
      columns(2)[
        #showybox(
        title-style: (boxed-style: (:)),
        title: "ADA",
        [#ada]
        )
        #colbreak()
        #showybox(
          title-style: (boxed-style: (:)),
          title: "Assets",
          [#assets]
        )
      ],
      footer: datum
    )
]

#let datum_none = showybox(
    title-style: (boxed-style: (:)),
    title: "Datum",
    [None])


#let owner_input = tx_input(title: "Owner", ada: "100", assets: "NFT_1, NFT_2, NFT_3, NFT_4", datum: datum_none)


#let marketplace_datum = showybox(
      title-style: (boxed-style: (:)),
      title: "Datum",[
        ==== Payouts
          + Seller Payout
            - Seller Address
            - Value: [NFT_5, NFT_6]
          + Optional Royalty Payout(s)
            - Royalty Address
            - Value: [1 ADA]
        ==== OwnerPkh
          - pkh of the owner
        
      ]
    )

#let marketplace_output = tx_output(
  title: "Marketplace",
  ada: "1.5",
  assets: "NFT_1, NFT_2, NFT_3, NFT_4",
  datum: marketplace_datum
)

#let owner_output = tx_output(
  title: "Owner",
  ada: "98.5 minus tx fee",
  assets: "None",
  datum: datum_none
)

#let buyer_input = tx_input(title: "Buyer", ada: "50", assets: "NFT_5, NFT_6", datum: datum_none)
#let marketplace_fee_datum = showybox(
      title-style: (boxed-style: (:)),
      title: "Datum",
      [
        blake2b256(spend_tx_out_ref) - to prevent double satisfaction
      ]
    )
#let marketplace_fee_output = tx_output(
  title: "Marketplace Fee Address",
  ada: "2",
  assets: "None",
  datum: marketplace_fee_datum
)

#let trade_owner_output = tx_output(
  title: "Seller",
  ada: "1.5",
  assets: "NFT_5, NFT_6",
  datum: datum_none
)

#let trade_royalty_output = tx_output(
  title: "Royalty",
  ada: "1",
  assets: "None",
  datum: datum_none
)

#let buyer_output = tx_output(
  title: "Buyer",
  ada: "47 minus tx fee",
  assets: "NFT_1, NFT_2, NFT_3, NFT_4",
  datum: datum_none
)

#let cancel_output = tx_output(
  title: "Owner",
  ada: "1.5 minus tx fee",
  assets: "NFT_1, NFT_2, NFT_3, NFT_4",
  datum: datum_none
)

#let listing_transaction = [
  #showybox(
  title-style: (boxed-style: (:)),
  title: "Listing Transaction",
  columns(2)[
    // Inputs
    #showybox(
        frame: (
          border-color: green.darken(50%),
          title-color: green.lighten(60%),
          body-color: green.lighten(80%)
        ),
        title-style: (
          color: black,
          weight: "bold",
          align: center
        ),
        shadow: (
          offset: 3pt,
        ),
        title: "Inputs",

        // Inputs
        owner_input
      )
      #colbreak()

    // Outputs
      #showybox(
        frame: (
          border-color: red.darken(50%),
          title-color: red.lighten(60%),
          body-color: red.lighten(80%)
        ),
        title-style: (
          color: black,
          weight: "bold",
          align: center
        ),
        shadow: (
          offset: 3pt,
        ),
        title: "Outputs",

        // Outputs,
        marketplace_output,
        owner_output
      )
      ]
)
]

#let buying_transaction = [
  #showybox(
  title-style: (boxed-style: (:)),
  title: "Buying Transaction",
  columns(2)[
    // Inputs
    #showybox(
        frame: (
          border-color: green.darken(50%),
          title-color: green.lighten(60%),
          body-color: green.lighten(80%)
        ),
        title-style: (
          color: black,
          weight: "bold",
          align: center
        ),
        shadow: (
          offset: 3pt,
        ),
        title: "Inputs",

        // Inputs
        showybox(
          footer: [Redeemer: Spend, Buy(offset: 0)],
          marketplace_output
        ),
        buyer_input
      )
      #colbreak()

    // Outputs
      #showybox(
        frame: (
          border-color: red.darken(50%),
          title-color: red.lighten(60%),
          body-color: red.lighten(80%)
        ),
        title-style: (
          color: black,
          weight: "bold",
          align: center
        ),
        shadow: (
          offset: 3pt,
        ),
        title: "Outputs",

        // Outputs,
        marketplace_fee_output,
        trade_owner_output,
        trade_royalty_output,
        buyer_output
      )
      ]
)
]

#let cancel_transaction = [
  #showybox(
  title-style: (boxed-style: (:)),
  title: "Cancel Transaction",
  columns(2)[
    // Inputs
    #showybox(
        frame: (
          border-color: green.darken(50%),
          title-color: green.lighten(60%),
          body-color: green.lighten(80%)
        ),
        title-style: (
          color: black,
          weight: "bold",
          align: center
        ),
        shadow: (
          offset: 3pt,
        ),
        title: "Inputs",
        [might need to add additional inputs to cover fee + min-ada],
        // Inputs
        showybox(
          footer: [Redeemer: Spend, WithdrawOrUpdate],
          marketplace_output
        )
      )
      #colbreak()

    // Outputs
      #showybox(
        frame: (
          border-color: red.darken(50%),
          title-color: red.lighten(60%),
          body-color: red.lighten(80%)
        ),
        title-style: (
          color: black,
          weight: "bold",
          align: center
        ),
        shadow: (
          offset: 3pt,
        ),
        title: "Outputs",

        // Outputs,
        cancel_output
      )
      ]
)
]