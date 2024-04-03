#import "template.typ": *

#set text(font: "EB Garamond",fallback: true, size: 11pt)
#set page(
  numbering: "1", 
  header: locate(
    loc => if [#loc.page()] == [1] {
        none
    } else {
        align(center)[
          CRASHR PROTOCOL SPECIFICATION
        ]
    }
  ),
  margin: (top: 1.5in, bottom: 2.5cm, left: 1.3in, right: 1.3in)
)
#set par(justify: true, first-line-indent: 1.5em)
#set heading(numbering: "1.1.", depth: 2)
#set list(indent: 1.5em)

#show heading: it =>  {
    it
    block(inset: (top: -2em))[]
    par()[#text()[#h(0.0em)]]
}
#show heading.where(level: 1): set text(size: 14pt, font:"Inter")
#show heading.where(level: 2): set text(size: 12pt, font:"Inter")
#show heading.where(level: 3): set text(size: 11pt, font:"Inter")
#show heading.where(level: 3): set block(inset: (left: 1.5em))
#show link: underline

#wp_title
#wp_abstract
#wp_introduction
#wp_crashr_protocol_overview
#pagebreak()
#wp_smart_contract_specifications
#pagebreak()
#wp_crashr_transactions
#pagebreak()
#wp_offchain_architecture
#wp_future_development
#pagebreak()
#wp_acknowledgements

// CIP 68 NFT Profile
// Cross-chain 
// Staking 
// SDKs -> API SDK and Embeddable SDK
// NFT aggregation
