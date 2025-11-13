import { AssetName, BuiltinByteString, ConStr0, ConStr1, Integer, MaestroProvider, PolicyId, PubKeyAddress, ScriptHash } from "@meshsdk/core";

type OrderType = ConStr0<[Integer]> | ConStr1<[Integer]>;

export type OrderDatumType = ConStr0<[
  OrderType,
  PubKeyAddress,
  BuiltinByteString,
]>;

type CredentialType = ConStr0<[BuiltinByteString]> | ConStr1<[ScriptHash]>;

type AssetType = ConStr0<[
  ConStr0 | ConStr1,
  PolicyId,
  AssetName,
  Integer,
]>;

export type PoolDatumType = ConStr0<[
  CredentialType,
  Integer,
  Integer,
  Integer,
  Integer,
  AssetType,
  AssetName,
]>;

export type BlockchainProviderType = MaestroProvider;
