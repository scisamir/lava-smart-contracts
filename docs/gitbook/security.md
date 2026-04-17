# Security

## Smart contract audit

The Lava smart contracts were independently audited by **UTxO Company**, a specialist Cardano smart contract security firm. The audit covered all validators and library files across the full protocol.

All critical findings identified during the audit were resolved before mainnet deployment. The audit report is publicly available.

## How your funds are protected

Lava is fully non-custodial. Your assets are held by on-chain smart contracts, not by Lava or any third party. The contracts enforce every rule of the protocol automatically:

- Only you (or someone you authorize) can cancel your orders
- Batchers are authorized by the protocol and cannot redirect your funds to themselves
- The exchange rate can only increase, never decrease
- Pool operators cannot withdraw user funds

## Smart contract architecture

The protocol is built in Aiken, the native smart contract language for Cardano Plutus v3. Key security properties:

- **One-shot NFTs** identify each pool and the global settings uniquely, preventing spoofing
- **Authorized batchers** are set by the protocol admin and listed on-chain; only they can process orders
- **Admin controls** require a multisig threshold, so no single key can change protocol settings
- **Reference inputs** allow validators to read shared configuration without risking contention on a single UTxO

## Third-party protocol risk

When you deploy L-Assets into external protocols (for liquidity provision, lending, yield farming), you are exposed to the smart contract risk of those protocols in addition to Lava's own. The Lava app displays a warning when interacting with Earn pools for this reason.

Lava only integrates with audited and established Cardano protocols, but no smart contract system is risk-free.

## Reporting a vulnerability

If you discover a potential vulnerability in the Lava protocol, please report it responsibly through the official security contact listed on [lava.finance](https://lava.finance). Do not disclose vulnerabilities publicly before they have been addressed.
