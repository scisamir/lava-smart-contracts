"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ADA_LOGO, LAVA_LOGO } from "@/lib/images";
import { HeroGlow } from "@/components/home/HeroGlow";
import { PageHeading, Stat } from "@/components/layout/Section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

const NET_APY = 4.32; // %
const USD_TO_ADA = 0.56;

const getTokenIcon = (symbol: string) =>
  String(symbol ?? "").trim() === "ADA" ? ADA_LOGO.src : LAVA_LOGO.src;

const Delta = ({ value, positive }: { value: string; positive: boolean }) => (
  <span className={`tabular ${positive ? "text-[#7ddba3]" : "text-[#df473d]"}`}>{value}</span>
);

const Portfolio = () => {
  const { tokenBalances } = useCardanoWallet();

  // Convert tokenBalances object → renderable list
  const assets = Object.entries(tokenBalances)
    .filter(([, amount]) => amount > 0)
    .map(([symbol, amount]) => {
      const normalizedAmount = symbol === "LADA" ? amount / 1_000_000 : amount;
      const priceUsd = 0.32; // mock price

      const valueNumber = normalizedAmount * priceUsd;

      const changeValue = Math.random() * 20;
      const changePercent = Math.random() * 6 - 3; // -3% → +3%
      const isPositive = changePercent >= 0;

      return {
        symbol,
        amount: normalizedAmount,
        valueNumber,
        value: `$${valueNumber.toFixed(2)}`,
        changeNumber: isPositive ? changeValue : -changeValue,
        change: `${isPositive ? "+" : "-"}$${changeValue.toFixed(2)}`,
        changePercent: `${isPositive ? "+" : ""}${changePercent.toFixed(2)}%`,
        isPositive,
      };
    });

  //Portfolio Calculations

  const netWorth = assets.reduce((sum, asset) => sum + asset.valueNumber, 0);

  const netWorthAda = netWorth * USD_TO_ADA;

  const totalPnL = assets.reduce((sum, asset) => sum + asset.changeNumber, 0);

  const totalYieldEarned = (netWorth * NET_APY) / 100;

  const pnlIsPositive = totalPnL >= 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />

      <main className="flex-1">
        <section className="relative isolate overflow-hidden pb-[clamp(48px,7vw,96px)] pt-[140px] sm:pt-[164px]">
          <HeroGlow />

          <div className="shell relative z-10 flex flex-col gap-10">
            <PageHeading
              eyebrow="/portfolio"
              title={
                <>
                  Your <span className="text-sheen">position</span>
                </>
              }
            />

            {/* ---- Net worth ---- */}
            <div data-reveal className="lava-card lava-card--soft p-6 sm:p-8">
              <div className="relative z-[4]">
                <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                  Net worth
                </p>
                <div className="mt-3 flex flex-col items-baseline gap-2 sm:flex-row sm:gap-4">
                  <p className="tabular text-[clamp(40px,6vw,64px)] font-medium leading-none tracking-tightest">
                    ${netWorth.toFixed(2)}
                  </p>
                  <span className="tabular font-mono-lava text-[16px] text-dim">
                    {netWorthAda.toFixed(2)} ADA
                  </span>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
                  <Stat
                    label="Total PnL"
                    value={
                      <Delta
                        value={`${pnlIsPositive ? "+" : ""}$${totalPnL.toFixed(2)}`}
                        positive={pnlIsPositive}
                      />
                    }
                  />
                  <Stat
                    label="24h gain/loss"
                    value={
                      <Delta
                        value={`${pnlIsPositive ? "+" : ""}$${totalPnL.toFixed(2)}`}
                        positive={pnlIsPositive}
                      />
                    }
                  />
                  <Stat
                    label="Total yield earned"
                    value={<Delta value={`$${totalYieldEarned.toFixed(2)}`} positive />}
                  />
                  <Stat label="Net APY" value={`${NET_APY}%`} />
                </div>
              </div>
            </div>

            {/* ---- Holdings ---- */}
            <div className="flex flex-col gap-6">
              <h2
                data-reveal
                className="flex items-center gap-3 text-[clamp(24px,2.6vw,32px)] font-medium tracking-tightest"
              >
                Holdings
                <span className="lava-slug">{assets.length}</span>
              </h2>

              {assets.length === 0 ? (
                <div data-reveal className="lava-panel p-10 text-center">
                  <p className="relative z-[4] text-[15px] text-dim">
                    Nothing here yet. Connect a wallet with ADA or L&#8209;ADA to see your position.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div data-reveal className="lava-panel hidden md:block">
                    <div className="relative z-[4]">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Asset</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>24h gain/loss</TableHead>
                            <TableHead>24h gain/loss %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assets.map((asset, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <span className="inline-flex items-center gap-2.5">
                                  <img
                                    src={getTokenIcon(asset.symbol)}
                                    alt=""
                                    className="h-7 w-7 shrink-0 object-contain"
                                  />
                                  <span className="tabular font-medium">
                                    {asset.amount.toFixed(2)}{" "}
                                    <span className="text-dim">{asset.symbol}</span>
                                  </span>
                                </span>
                              </TableCell>
                              <TableCell className="tabular font-medium">{asset.value}</TableCell>
                              <TableCell>
                                <Delta value={asset.change} positive={asset.isPositive} />
                              </TableCell>
                              <TableCell>
                                <Delta value={asset.changePercent} positive={asset.isPositive} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="flex flex-col gap-3 md:hidden">
                    {assets.map((asset, index) => (
                      <div key={index} data-reveal className="lava-panel p-4">
                        <div className="relative z-[4] flex flex-col gap-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2.5">
                              <img
                                src={getTokenIcon(asset.symbol)}
                                alt=""
                                className="h-8 w-8 object-contain"
                              />
                              <span className="tabular text-[15px] font-medium tracking-tighter">
                                {asset.amount.toFixed(2)}{" "}
                                <span className="text-dim">{asset.symbol}</span>
                              </span>
                            </span>
                            <span className="tabular text-[15px] font-medium">{asset.value}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                                24h gain/loss
                              </p>
                              <p className="mt-1">
                                <Delta value={asset.change} positive={asset.isPositive} />
                              </p>
                            </div>
                            <div>
                              <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                                24h gain/loss %
                              </p>
                              <p className="mt-1">
                                <Delta value={asset.changePercent} positive={asset.isPositive} />
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Portfolio;
