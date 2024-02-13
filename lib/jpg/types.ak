use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{Address, Script, VerificationKey}
use aiken/transaction/value.{Value}

pub type ScriptHash =
  Hash<Blake2b_224, Script>

pub type VerificationKeyHash =
  Hash<Blake2b_224, VerificationKey>

pub type Payout {
  address: Address,
  amount: Value,
}
