"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  batchOrdersTx,
  cancelOrderTx,
  createOrderTx,
  stakePoolToAtriumTx,
  withdrawPoolFromAtriumTx,
} from "@/lib/latest-e2e/actions";
import { toSafeIntegerNumber } from "@/generated/atrium_mainnet/safe";
import { fetchTestingSnapshot } from "@/lib/latest-e2e/query";
import { formatAda, formatUnits, parseDecimalToInt } from "@/lib/latest-e2e/helpers";
import {
  clearStoredWalletKey,
  connectTestingWallet,
  resolveWalletAddress,
  restoreTestingWallet,
  storeWalletKey,
  type TestingWallet,
} from "@/lib/latest-e2e/wallet";
import type { OrderKind, TestingSnapshot } from "@/lib/latest-e2e/types";

type DetectedWallet = {
  key: string;
  name: string;
  icon?: string;
};

const explorerUrl = (txHash: string) =>
  `https://cardanoscan.io/transaction/${txHash}`;

const formatOrderAmount = (kind: OrderKind, amount: bigint) =>
  kind === "deposit" ? formatAda(amount) : `${formatUnits(amount)} LADA`;

type UiOrder = {
  id: string;
  txHash: string;
  outputIndex: number;
  kind: OrderKind;
  amountLabel: string;
  wrapperLovelaceLabel: string;
};

type UiSnapshot = {
  orderStats: {
    totalPending: number;
    depositCount: number;
    redeemCount: number;
    totalDepositLabel: string;
    totalRedeemLabel: string;
  };
  pool: {
    txRef: string;
    totalUnderlyingLabel: string;
    totalStAssetsMintedLabel: string;
    availableToStakeLabel: string;
  };
  atrium: {
    basketExchangeRateLabel: string;
    basketLockLabel: string;
    pledgeLockLabel: string;
    rewardDiffusionLabel: string;
    estimatedAdaFromRewardsLabel: string;
    selectedRewardRef: string | null;
  };
  userOrders: UiOrder[];
  warnings: string[];
};

const withUiFallback = <T,>(
  warnings: string[],
  label: string,
  fallback: T,
  run: () => T,
): T => {
  try {
    return run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`UI ${label} fallback: ${message}`);
    return fallback;
  }
};

const toUiSnapshot = (snapshot: TestingSnapshot): UiSnapshot => {
  const warnings = Array.isArray(snapshot.warnings)
    ? snapshot.warnings.map(String)
    : [];
  const snapshotUserOrders = Array.isArray(snapshot.userOrders)
    ? snapshot.userOrders
    : [];

  const userOrders = snapshotUserOrders.flatMap((order) => {
    try {
      return [{
        id: order.id,
        txHash: order.txHash,
        outputIndex: toSafeIntegerNumber(
          String(order.outputIndex),
          `Order ${order.id} output index`,
        ),
        kind: order.kind,
        amountLabel: formatOrderAmount(order.kind, order.amount),
        wrapperLovelaceLabel: formatAda(order.wrapperLovelace),
      }];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(
        `Skipping cancel for order ${order.id}: ${message}`,
      );
      return [];
    }
  });

  return {
    orderStats: withUiFallback(
      warnings,
      "order stats",
      {
        totalPending: 0,
        depositCount: 0,
        redeemCount: 0,
        totalDepositLabel: "0 ADA",
        totalRedeemLabel: "0 LADA",
      },
      () => ({
        totalPending: snapshot.orderStats.totalPending,
        depositCount: snapshot.orderStats.depositCount,
        redeemCount: snapshot.orderStats.redeemCount,
        totalDepositLabel: formatAda(snapshot.orderStats.totalDepositAmount),
        totalRedeemLabel: `${formatUnits(snapshot.orderStats.totalRedeemAmount)} LADA`,
      }),
    ),
    pool: withUiFallback(
      warnings,
      "pool summary",
      {
        txRef: "-",
        totalUnderlyingLabel: "0 ADA",
        totalStAssetsMintedLabel: "0",
        availableToStakeLabel: "0 ADA",
      },
      () => ({
        txRef: snapshot.pool.txRef,
        totalUnderlyingLabel: formatAda(snapshot.pool.totalUnderlying),
        totalStAssetsMintedLabel: formatUnits(snapshot.pool.totalStAssetsMinted),
        availableToStakeLabel: formatAda(snapshot.pool.availableToStake),
      }),
    ),
    atrium: withUiFallback(
      warnings,
      "atrium summary",
      {
        basketExchangeRateLabel: "Unavailable",
        basketLockLabel: "Unavailable",
        pledgeLockLabel: "Unavailable",
        rewardDiffusionLabel: "0",
        estimatedAdaFromRewardsLabel: "0 ADA",
        selectedRewardRef: null,
      },
      () => ({
        basketExchangeRateLabel: snapshot.atrium.basketExchangeRateLabel,
        basketLockLabel: snapshot.atrium.basketLockLabel,
        pledgeLockLabel: snapshot.atrium.pledgeLockLabel,
        rewardDiffusionLabel: formatUnits(snapshot.atrium.rewardDiffusion),
        estimatedAdaFromRewardsLabel: formatAda(
          snapshot.atrium.estimatedAdaFromRewards,
        ),
        selectedRewardRef: snapshot.atrium.selectedRewardRef,
      }),
    ),
    userOrders,
    warnings,
  };
};

export default function HomePage() {
  const [availableWallets, setAvailableWallets] = useState<DetectedWallet[]>([]);
  const [wallet, setWallet] = useState<TestingWallet | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [snapshot, setSnapshot] = useState<UiSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectingWalletKey, setConnectingWalletKey] = useState("");
  const [hasTriedRestore, setHasTriedRestore] = useState(false);
  const [orderKind, setOrderKind] = useState<OrderKind>("deposit");
  const [orderAmount, setOrderAmount] = useState("7");
  const [activeAction, setActiveAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [lastTxHash, setLastTxHash] = useState("");
  const connected = wallet !== null;

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).cardano) {
      setAvailableWallets([]);
      return;
    }

    const cardano = (window as any).cardano;
    const detected = Object.keys(cardano)
      .filter((key) => cardano[key]?.enable)
      .map((key) => ({
        key,
        name: cardano[key].name ?? key,
        icon: cardano[key].icon,
      }));

    setAvailableWallets(detected);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreWallet = async () => {
      try {
        const restoredWallet = await restoreTestingWallet();
        if (!restoredWallet || cancelled) {
          return;
        }

        const restoredAddress = await resolveWalletAddress(restoredWallet);
        if (cancelled) {
          return;
        }

        setWallet(restoredWallet);
        setWalletAddress(restoredAddress);
      } catch (error) {
        clearStoredWalletKey();
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          setActionError(`Wallet restore failed: ${message}`);
        }
      } finally {
        if (!cancelled) {
          setHasTriedRestore(true);
        }
      }
    };

    void restoreWallet();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSnapshot = async () => {
    setIsRefreshing(true);
    setSnapshotError("");

    try {
      const nextSnapshot = await fetchTestingSnapshot(walletAddress || undefined);
      const nextUiSnapshot = (() => {
        try {
          return toUiSnapshot(nextSnapshot);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`ui snapshot normalization: ${message}`);
        }
      })();

      setSnapshot(nextUiSnapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSnapshotError(`Snapshot refresh failed: ${message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshSnapshot();

    const interval = window.setInterval(() => {
      void refreshSnapshot();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [walletAddress]);

  const runAction = async (label: string, fn: () => Promise<string>) => {
    setActiveAction(label);
    setActionError("");
    setLastTxHash("");

    try {
      const txHash = await fn();
      setLastTxHash(txHash);
      await refreshSnapshot();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActiveAction("");
    }
  };

  const connectWallet = async (walletKey: string) => {
    setActionError("");
    setLastTxHash("");
    setConnectingWalletKey(walletKey);

    try {
      const nextWallet = await connectTestingWallet(walletKey);
      const nextAddress = await resolveWalletAddress(nextWallet);
      storeWalletKey(walletKey);
      setWallet(nextWallet);
      setWalletAddress(nextAddress);
    } catch (error) {
      clearStoredWalletKey();
      setWallet(null);
      setWalletAddress("");
      const message = error instanceof Error ? error.message : String(error);
      setActionError(`Wallet connect failed: ${message}`);
    } finally {
      setConnectingWalletKey("");
    }
  };

  const disconnectWallet = () => {
    clearStoredWalletKey();
    setWallet(null);
    setWalletAddress("");
    setActionError("");
    setLastTxHash("");
  };

  const connectLabel = useMemo(() => {
    if (!walletAddress) {
      return "Connect wallet";
    }

    return `${walletAddress.slice(0, 12)}...${walletAddress.slice(-8)}`;
  }, [walletAddress]);

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Standalone testing frontend</span>
          <h1>Lava Latest E2E Console</h1>
          <p>
            This is a separate browser-only console for the root <code>e2e/</code>{" "}
            flows: create order, cancel order, batch, stake the Atrium Lava pool,
            and withdraw from Atrium.
          </p>
        </div>

        <div className="wallet-panel">
          <div className="wallet-header">
            <span>Wallet</span>
            {connected ? (
              <button className="ghost-btn" onClick={disconnectWallet}>
                Disconnect
              </button>
            ) : null}
          </div>

          <div className="wallet-address">{connectLabel}</div>

          <div className="wallet-list">
            {availableWallets.length === 0 ? (
              <div className="muted-card">
                No Cardano wallet extension detected in this browser.
              </div>
            ) : (
              availableWallets.map((walletOption: DetectedWallet) => (
                <button
                  key={walletOption.key}
                  className="wallet-option"
                  disabled={connectingWalletKey !== "" || !hasTriedRestore}
                  onClick={() => void connectWallet(walletOption.key)}
                >
                  <span>
                    {connectingWalletKey === walletOption.key
                      ? `Connecting ${walletOption.name}...`
                      : walletOption.name}
                  </span>
                  {walletOption.icon ? (
                    <img src={walletOption.icon} alt={walletOption.name} />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Pending orders</span>
          <strong>{snapshot?.orderStats.totalPending ?? 0}</strong>
        </article>
        <article className="stat-card">
          <span>Pending deposits</span>
          <strong>{snapshot?.orderStats.totalDepositLabel ?? "0 ADA"}</strong>
        </article>
        <article className="stat-card">
          <span>Pending redeems</span>
          <strong>{snapshot?.orderStats.totalRedeemLabel ?? "0 LADA"}</strong>
        </article>
        <article className="stat-card">
          <span>Pool available to stake</span>
          <strong>{snapshot?.pool.availableToStakeLabel ?? "0 ADA"}</strong>
        </article>
      </section>

      {snapshotError ? <div className="error-banner">{snapshotError}</div> : null}
      {actionError ? <div className="error-banner">{actionError}</div> : null}
      {lastTxHash ? (
        <div className="success-banner">
          Transaction submitted:
          <a href={explorerUrl(lastTxHash)} target="_blank" rel="noreferrer">
            {lastTxHash}
          </a>
        </div>
      ) : null}

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Orders</span>
              <h2>Create order</h2>
            </div>
            <button className="ghost-btn" onClick={() => void refreshSnapshot()}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="toggle-row">
            <button
              className={orderKind === "deposit" ? "toggle active" : "toggle"}
              onClick={() => setOrderKind("deposit")}
            >
              Deposit order
            </button>
            <button
              className={orderKind === "redeem" ? "toggle active" : "toggle"}
              onClick={() => setOrderKind("redeem")}
            >
              Redeem order
            </button>
          </div>

          <label className="field">
            <span>
              Amount {orderKind === "deposit" ? "(ADA)" : "(LADA / st units)"}
            </span>
            <input
              value={orderAmount}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setOrderAmount(event.target.value)
              }
              placeholder={orderKind === "deposit" ? "7" : "10"}
            />
          </label>

          <button
            className="primary-btn"
            disabled={!wallet || !connected || activeAction !== ""}
            onClick={() =>
              void runAction("create-order", async () =>
                createOrderTx(
                  wallet as any,
                  orderKind,
                  parseDecimalToInt(orderAmount, 6),
                ),
              )
            }
          >
            {activeAction === "create-order" ? "Submitting..." : "Create order"}
          </button>

          <p className="muted">
            Deposit orders lock ADA in the order script. Redeem orders lock the
            Atrium stake asset and wait for batching.
          </p>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Batching</span>
              <h2>Batch pending orders</h2>
            </div>
          </div>

          <div className="metric-list">
            <div>
              <span>Total pending</span>
              <strong>{snapshot?.orderStats.totalPending ?? 0}</strong>
            </div>
            <div>
              <span>Deposit count</span>
              <strong>{snapshot?.orderStats.depositCount ?? 0}</strong>
            </div>
            <div>
              <span>Redeem count</span>
              <strong>{snapshot?.orderStats.redeemCount ?? 0}</strong>
            </div>
          </div>

          <button
            className="primary-btn"
            disabled={activeAction !== ""}
            onClick={() => void runAction("batch-orders", batchOrdersTx)}
          >
            {activeAction === "batch-orders"
              ? "Batching..."
              : "Batch with env wallet"}
          </button>

          <p className="muted">
            This uses the public test mnemonic from{" "}
            <code>NEXT_PUBLIC_BATCHER_WALLET_MNEMONIC</code> for browser-side
            batching.
          </p>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <span className="eyebrow">My orders</span>
              <h2>Cancel queued orders</h2>
            </div>
          </div>

          {snapshot?.userOrders.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Amount</th>
                    <th>Wrapper</th>
                    <th>Ref</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {snapshot.userOrders.map((order: UiOrder) => (
                    <tr key={order.id}>
                      <td>{order.kind}</td>
                      <td>{order.amountLabel}</td>
                      <td>{order.wrapperLovelaceLabel}</td>
                      <td className="mono">{order.id}</td>
                      <td>
                        <button
                          className="ghost-btn"
                          disabled={!wallet || activeAction !== ""}
                          onClick={() =>
                            void runAction(`cancel-${order.id}`, async () =>
                              cancelOrderTx(
                                wallet as any,
                                order.txHash,
                                order.outputIndex,
                              ),
                            )
                          }
                        >
                          {activeAction === `cancel-${order.id}`
                            ? "Cancelling..."
                            : "Cancel"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="muted-card">
              {walletAddress
                ? "No pending orders found for the connected wallet."
                : "Connect a wallet to see your pending orders."}
            </div>
          )}
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Pool admin</span>
              <h2>Atrium Lava pool</h2>
            </div>
          </div>

          <div className="metric-list">
            <div>
              <span>Pool UTxO</span>
              <strong className="mono">{snapshot?.pool.txRef ?? "-"}</strong>
            </div>
            <div>
              <span>Total underlying</span>
              <strong>{snapshot?.pool.totalUnderlyingLabel ?? "-"}</strong>
            </div>
            <div>
              <span>Total st minted</span>
              <strong>{snapshot?.pool.totalStAssetsMintedLabel ?? "-"}</strong>
            </div>
            <div>
              <span>Exchange rate</span>
              <strong>{snapshot?.atrium.basketExchangeRateLabel ?? "-"}</strong>
            </div>
            <div>
              <span>Rewards ready</span>
              <strong>{snapshot?.atrium.rewardDiffusionLabel ?? "-"}</strong>
            </div>
            <div>
              <span>ADA claimable</span>
              <strong>{snapshot?.atrium.estimatedAdaFromRewardsLabel ?? "-"}</strong>
            </div>
          </div>

          <div className="stack">
            <button
              className="primary-btn"
              disabled={!wallet || !connected || activeAction !== ""}
              onClick={() =>
                void runAction("stake-pool", async () =>
                  stakePoolToAtriumTx(wallet as any),
                )
              }
            >
              {activeAction === "stake-pool"
                ? "Submitting..."
                : "Stake / deposit pool to Atrium"}
            </button>
            <button
              className="secondary-btn"
              disabled={!wallet || !connected || activeAction !== ""}
              onClick={() =>
                void runAction("withdraw-pool", async () =>
                  withdrawPoolFromAtriumTx(wallet as any),
                )
              }
            >
              {activeAction === "withdraw-pool"
                ? "Submitting..."
                : "Unstake / withdraw from Atrium"}
            </button>
          </div>

          <div className="metric-list compact">
            <div>
              <span>Basket lock</span>
              <strong>{snapshot?.atrium.basketLockLabel ?? "-"}</strong>
            </div>
            <div>
              <span>Pledge lock</span>
              <strong>{snapshot?.atrium.pledgeLockLabel ?? "-"}</strong>
            </div>
            <div>
              <span>Reward UTxO</span>
              <strong className="mono">{snapshot?.atrium.selectedRewardRef ?? "-"}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Notes</span>
              <h2>Testing assumptions</h2>
            </div>
          </div>

          <ul className="note-list">
            <li>The scope is only the root <code>e2e/</code> transactions.</li>
            <li>Batching happens in-browser with a public test mnemonic from env.</li>
            <li>Admin actions use the connected wallet exactly like a normal signer.</li>
            <li>
              This page is intentionally minimal and direct, so failures surface
              the raw contract/runtime message instead of hiding them.
            </li>
          </ul>

          {snapshot?.warnings.length ? (
            <div className="warning-card">
              {snapshot.warnings.map((warning: string) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
