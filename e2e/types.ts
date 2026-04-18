import {
  AssetName,
  Bool,
  BuiltinByteString,
  ConStr0,
  ConStr1,
  ConStr2,
  ConStr3,
  Integer,
  PolicyId,
  PubKeyAddress,
  ScriptHash,
  ScriptAddress,
} from "@meshsdk/core";

type OrderType = ConStr0<[Integer]> | ConStr1<[Integer]>;

type AddressType = PubKeyAddress | ScriptAddress;

type SignerType =
  | ConStr0<[BuiltinByteString]>
  | ConStr1<[ScriptHash]>
  | ConStr2<[ScriptHash]>
  | ConStr3<[ScriptHash]>;

type OrderDatumType = ConStr0<[OrderType, AddressType, SignerType, AssetName]>;

type CredentialType = ConStr0<[BuiltinByteString]> | ConStr1<[ScriptHash]>;

type AssetType = ConStr0<[Bool, PolicyId, AssetName, Integer]>;

type PoolDatumType = ConStr0<
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

export { OrderDatumType, PoolDatumType };
