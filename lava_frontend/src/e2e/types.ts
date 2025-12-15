import {
  AssetName,
  Bool,
  BuiltinByteString,
  ConStr0,
  ConStr1,
  Integer,
  MaestroProvider,
  PolicyId,
  PubKeyAddress,
  ScriptHash,
} from "@meshsdk/core";

type OrderType = ConStr0<[Integer]> | ConStr1<[Integer]>;

export type OrderDatumType = ConStr0<
  [OrderType, PubKeyAddress, BuiltinByteString]
>;

type CredentialType = ConStr0<[BuiltinByteString]> | ConStr1<[ScriptHash]>;

type AssetType = ConStr0<[ConStr0 | ConStr1, PolicyId, AssetName, Integer]>;

export type PoolDatumType = ConStr0<
  [
    CredentialType, // pool batching cred
    Integer, // total_st_assets_minted
    Integer, // total_underlying
    Integer, // exchange_rate
    Integer, // total_rewards_accrued
    AssetType, // pool asset
    AssetName, // pool stake asset name
    Bool // is processing open
  ]
>;

export type BlockchainProviderType = MaestroProvider;
