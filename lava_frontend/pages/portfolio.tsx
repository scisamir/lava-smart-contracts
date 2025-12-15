"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { LAVA_LOGO } from "@/lib/images";
import portfolioGraphic from "@/assets/portfolio-graphic.png";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

const NET_APY = 4.32; // %
const USD_TO_ADA = 0.56;

const Portfolio = () => {
  const { tokenBalances } = useCardanoWallet();

  // Convert tokenBalances object → renderable list
  const assets = Object.entries(tokenBalances)
    .filter(([, amount]) => amount > 0)
    .map(([symbol, amount]) => {
      const priceUsd = 0.32; // mock price

      const valueNumber = amount * priceUsd;

      const changeValue = Math.random() * 20;
      const changePercent = Math.random() * 6 - 3; // -3% → +3%
      const isPositive = changePercent >= 0;

      return {
        symbol,
        amount,
        valueNumber,
        value: `$${valueNumber.toFixed(2)}`,
        changeNumber: isPositive ? changeValue : -changeValue,
        change: `${isPositive ? "+" : "-"}$${changeValue.toFixed(2)}`,
        changePercent: `${isPositive ? "+" : ""}${changePercent.toFixed(2)}%`,
        isPositive,
      };
    });

  
     //Portfolio Calculations

  const netWorth = assets.reduce(
    (sum, asset) => sum + asset.valueNumber,
    0
  );

  	  const netWorthAda = netWorth * USD_TO_ADA;


  const totalPnL = assets.reduce(
    (sum, asset) => sum + asset.changeNumber,
    0
  );

  const totalYieldEarned = (netWorth * NET_APY) / 100;

  const pnlIsPositive = totalPnL >= 0;

  return (
    <div className="min-h-screen">
      <Navigation />

      <section className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Net Worth */}
          <div className="mb-12 flex items-start gap-8">
            <div className="flex-1">
              <p className="text-muted-foreground mb-2">Net Worth</p>
              <div className="flex items-baseline gap-4 mb-6">
                <h1 className="text-5xl md:text-6xl font-bold">
                  ${netWorth.toFixed(2)}
                </h1>
                <span className="text-xl text-muted-foreground">
  					{netWorthAda.toFixed(2)} ADA
				</span>

              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Total PnL
                  </p>
                  <p
                    className={`text-2xl font-semibold ${
                      pnlIsPositive ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {pnlIsPositive ? "+" : ""}${totalPnL.toFixed(2)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    24h Gain/Loss
                  </p>
                  <p
                    className={`text-2xl font-semibold ${
                      pnlIsPositive ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {pnlIsPositive ? "+" : ""}${totalPnL.toFixed(2)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Yield Earned
                  </p>
                  <p className="text-2xl font-semibold text-green-500">
                    ${totalYieldEarned.toFixed(2)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Net APY
                  </p>
                  <p className="text-2xl font-semibold">{NET_APY}%</p>
                </div>
              </div>
            </div>

            <div className="hidden lg:block flex-shrink-0 -mb-32">
              <img
                src={portfolioGraphic.src}
                alt="Portfolio graphic"
                className="w-[480px] h-auto"
              />
            </div>
          </div>

          {/* Holdings */}
          <div>
            <h2 className="text-3xl font-bold mb-6">Holdings</h2>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <Card className="bg-card border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm text-muted-foreground font-medium">
                          Asset
                        </th>
                        <th className="text-left px-4 py-3 text-sm text-muted-foreground font-medium">
                          Value
                        </th>
                        <th className="text-left px-4 py-3 text-sm text-muted-foreground font-medium">
                          24h Gain/Loss
                        </th>
                        <th className="text-center px-4 py-3 text-sm text-muted-foreground font-medium">
                          24h Gain/Loss %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset, index) => (
                        <tr
                          key={index}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <img
                                src={LAVA_LOGO.src}
                                alt={asset.symbol}
                                className="w-6 h-6"
                              />
                              <span className="font-medium">
                                {asset.amount}{" "}
                                <span className="text-muted-foreground">
                                  {asset.symbol}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {asset.value}
                          </td>
                          <td
                            className={`px-4 py-3 font-medium ${
                              asset.isPositive
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {asset.change}
                          </td>
                          <td
                            className={`px-4 py-3 font-medium text-center ${
                              asset.isPositive
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {asset.changePercent}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {assets.map((asset, index) => (
                <Card key={index} className="bg-card border-border p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <img
                          src={LAVA_LOGO.src}
                          alt={asset.symbol}
                          className="w-6 h-6"
                        />
                        <span className="font-medium">
                          {asset.amount}{" "}
                          <span className="text-muted-foreground">
                            {asset.symbol}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-muted-foreground mb-1">
                        Value
                      </p>
                      <p className="font-medium">{asset.value}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        24h Gain/Loss
                      </p>
                      <p
                        className={`font-medium ${
                          asset.isPositive
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {asset.change}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-muted-foreground mb-1">
                        24h Gain/Loss %
                      </p>
                      <p
                        className={`font-medium ${
                          asset.isPositive
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {asset.changePercent}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Portfolio;
