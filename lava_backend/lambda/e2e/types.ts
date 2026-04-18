import {
  AssetName,
  Bool,
  BuiltinByteString,
  ConStr0,
  ConStr1,
  ConStr2,
  ConStr3,
  Integer,
  MaestroProvider,
  PolicyId,
  PubKeyAddress,
  ScriptAddress,
  ScriptHash,
} from "@meshsdk/core";

type OrderType = ConStr0<[Integer]> | ConStr1<[Integer]>;

type AddressType = PubKeyAddress | ScriptAddress;

type SignerType =
  | ConStr0<[BuiltinByteString]>
  | ConStr1<[ScriptHash]>
  | ConStr2<[ScriptHash]>
  | ConStr3<[ScriptHash]>;

export type OrderDatumType = ConStr0<
  [OrderType, AddressType, SignerType, AssetName]
>;

type CredentialType = ConStr0<[BuiltinByteString]> | ConStr1<[ScriptHash]>;

type AssetType = ConStr0<[Bool, PolicyId, AssetName, Integer]>;

export type PoolDatumType = ConStr0<
  [
    CredentialType,
    Integer,
    Integer,
    Integer,
    Integer,
    AssetType,
    AssetName,
    Bool
  ]
>;

export type BlockchainProviderType = MaestroProvider;
