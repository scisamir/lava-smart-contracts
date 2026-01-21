"use client";


import { useEffect, useState } from "react";
import { useWallet } from "@meshsdk/react";
import { BlockchainProviderType } from "@/e2e/types";
import {
AssetExtended,
deserializeAddress,
MaestroProvider,
MeshTxBuilder,
stringToHex,
UTxO,
} from "@meshsdk/core";
import { fetchPoolInfo } from "@/e2e/utils";
import { PoolInfo } from "@/lib/types";


const LOCAL_STORAGE_KEY = "connectedWallet";


export function useCardanoWallet() {
const { wallet, connected, connect, disconnect, name } = useWallet();


const [walletAddress, setWalletAddress] = useState("");
const [balance, setBalance] = useState(0);
const [txBuilder, setTxBuilder] = useState<MeshTxBuilder | null>(null);
const [blockchainProvider, setBlockchainProvider] =
useState<BlockchainProviderType | null>(null);
const [walletVK, setWalletVK] = useState<string>("");
const [walletSK, setWalletSK] = useState<string>("");
const [walletUtxos, setWalletUtxos] = useState<UTxO[]>([]);
const [walletCollateral, setWalletCollateral] = useState<UTxO | null>(null);


const [tokenBalances, setTokenBalances] = useState<{ [key: string]: number }>(
{}
);
const [poolInfo, setPoolInfo] = useState<PoolInfo[]>([]);


// Helper to get token balance
const getTokenBalance = (
assets: AssetExtended[],
policyId: string,
assetName: string
): number => {
const assetHex = stringToHex(assetName);
const unit = policyId + assetHex;


let total = Number(
assets.find((ast) => ast.unit === unit)?.quantity ?? "0"
);


return total;
};



 /// FIXED RESTORE LOGIC - Only change here
  useEffect(() => {
    const restoreWallet = async () => {
      const lastWallet = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!lastWallet || connected) return;

      const cardano = (window as any).cardano;
      if (!cardano?.[lastWallet]) return;

      try {
        // PRODUCTION FIX 1: Add timeout + force UI
        await new Promise(resolve => setTimeout(resolve, 500));
        await cardano[lastWallet].enable({ ui: { forceShow: true } });
        
        // PRODUCTION FIX 2: Wait for Mesh to process before connect
        await new Promise(resolve => setTimeout(resolve, 300));
        await connect(lastWallet);
      } catch (err) {
        console.warn("Wallet restore failed:", err);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    };

    restoreWallet();
  }, [connect, connected]); // Keep original deps




// Fetch wallet data (UTxOs and token balances)
const fetchWalletData = async () => {
if (connected && wallet) {
try {
const addr = await wallet.getChangeAddress();
setWalletAddress(addr);


const assets = await wallet.getAssets();
const adaAsset = assets.find((a) => a.unit === "lovelace");
const balanceInAda = adaAsset
? Number(adaAsset.quantity) / 1_000_000
: 0;
setBalance(balanceInAda);


const { pubKeyHash: walletVK, stakeCredentialHash: walletSK } =
deserializeAddress(addr);
const walletUtxos = await wallet.getUtxos();
// const walletCollateral = (walletUtxos.filter(utxo => (utxo.output.amount.length === 1 && (Number(utxo.output.amount[0].quantity) >= 5000000 && Number(utxo.output.amount[0].quantity) <= 100000000))))[0];
const walletCollateral = walletUtxos.filter(
(utxo) =>
Number(utxo.output.amount[0].quantity) >= 7000000 &&
utxo.output.amount.length <= 4
)[0];


// Persist the connected wallet
if (name) localStorage.setItem(LOCAL_STORAGE_KEY, name);


const maestroKey = process.env.NEXT_PUBLIC_MAESTRO_KEY;
if (!maestroKey) {
throw new Error("MAESTRO_KEY does not exist");
}


const bp = new MaestroProvider({
network: "Preprod",
apiKey: maestroKey,
});
const tb = new MeshTxBuilder({
fetcher: bp,
submitter: bp,
evaluator: bp,
verbose: true,
});
tb.setNetwork("preprod");


const test = getTokenBalance(
assets,
"def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
"test"
);
const stTest = getTokenBalance(
assets,
"9c1dd9791eba86728634ec4d1531ff3f7ace179c3f8b1e75bfbf1906",
"stTest"
);
const tStrike = getTokenBalance(
assets,
"def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
"tStrike"
);
const LStrike = getTokenBalance(
assets,
"9c1dd9791eba86728634ec4d1531ff3f7ace179c3f8b1e75bfbf1906",
"LStrike"
);
const tPulse = getTokenBalance(
assets,
"def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
"tPulse"
);
const LPulse = getTokenBalance(
assets,
"9c1dd9791eba86728634ec4d1531ff3f7ace179c3f8b1e75bfbf1906",
"LPulse"
);


const poolInfoData = await fetchPoolInfo(bp);


setTxBuilder(tb);
setBlockchainProvider(bp);
setWalletVK(walletVK);
setWalletSK(walletSK);
setWalletCollateral(walletCollateral);
setWalletUtxos(walletUtxos);
setTokenBalances({
...tokenBalances,
test,
stTest,
tStrike,
LStrike,
tPulse,
LPulse,
});
setPoolInfo(poolInfoData);
} catch (err) {
console.error("Error fetching wallet data:", err);
}
} else {
setWalletAddress("");
setBalance(0);
setWalletUtxos([]);
setTokenBalances({});
setPoolInfo([]);
localStorage.removeItem(LOCAL_STORAGE_KEY);
return;
}
};
useEffect(() => {
fetchWalletData();
}, [connected, wallet, name]);


const connectWallet = async (walletName: string) => {
await connect(walletName);
localStorage.setItem(LOCAL_STORAGE_KEY, walletName);
};


const disconnectWallet = async () => {
localStorage.removeItem(LOCAL_STORAGE_KEY);
await disconnect();
};


const reloadWalletState = async () => {
await fetchWalletData();
};


return {
connected,
wallet,
walletName: name,
walletAddress,
balance,
tokenBalances,
connect: connectWallet,
disconnect: disconnectWallet,
reloadWalletState,
blockchainProvider,
txBuilder,
walletVK,
walletSK,
walletCollateral,
walletUtxos,
getTokenBalance,
poolInfo,
};
}