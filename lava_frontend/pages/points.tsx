"use client";

import { useState } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { SpinningCoin } from "@/components/brand/SpinningCoin";
import { TokenIcon } from "@/components/brand/TokenIcon";
import { Section, SectionIntro, Slug } from "@/components/layout/Section";
import { HeroGlow } from "@/components/home/HeroGlow";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { FLUIDTOKENS_LOGO } from "@/lib/images";

/* Daily points per 1 L-ADA, by what the token is doing. */
const RATES = [
  {
    key: "hold",
    slug: "/hold",
    title: "Hold L‑ADA",
    rate: 1,
    unit: "point per L‑ADA, per day",
    copy: "Points accrue on the L‑ADA sitting in your wallet. Nothing to lock, nothing to claim. The balance is measured daily.",
  },
  {
    key: "collateral",
    slug: "/collateral",
    title: "Supply L‑ADA on FluidTokens",
    rate: 2,
    unit: "points per L‑ADA, per day",
    copy: "L‑ADA posted as collateral on FluidTokens earns at double the holding rate, while the underlying keeps accruing staking rewards.",
  },
];

/*
 * Points balance for the connected wallet.
 *
 * Nothing tracks accrued points yet, so this deliberately does not invent a
 * figure. It shows the two things that are real: the wallet's L-ADA balance
 * and what that balance would earn per day at the published rates, and holds
 * accrued points at zero until the program actually starts.
 */
const PointsBalance = () => {
  const { connected, walletAddress, tokenBalances } = useCardanoWallet();

  const lada = (tokenBalances?.["LADA"] ?? 0) / 1_000_000;
  const dailyIfHeld = lada * RATES[0].rate;
  const format = (n: number, dp = 0) =>
    n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  return (
    <div data-reveal className="lava-card lava-card--soft w-full p-6 sm:p-7">
      <div className="relative z-[4]">
        <div className="flex items-center justify-between gap-4">
          <Slug>/balance</Slug>
          {connected && walletAddress ? (
            <span className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
              {truncate(walletAddress)}
            </span>
          ) : (
            <span className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
              Not connected
            </span>
          )}
        </div>

        {connected ? (
          <>
            <p className="mt-5 font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
              Points earned
            </p>
            <p className="tabular mt-2 text-[clamp(40px,6vw,60px)] font-medium leading-none tracking-tightest">
              0
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="lava-well p-4">
                <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                  L&#8209;ADA held
                </p>
                <p className="tabular mt-2 flex items-center gap-2 text-[20px] font-medium tracking-tightest">
                  <TokenIcon symbol="LADA" size={22} />
                  {format(lada, 2)}
                </p>
              </div>
              <div className="lava-well p-4">
                <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                  Rate once live
                </p>
                <p className="tabular mt-2 text-[20px] font-medium tracking-tightest">
                  {format(dailyIfHeld)}
                  <span className="ml-1.5 text-[13px] font-normal text-dim">/ day</span>
                </p>
              </div>
            </div>

            <p className="mt-4 text-[12.5px] leading-[1.5] text-dim">
              {lada > 0
                ? "Your balance is live. Points start counting when the program opens; nothing is accruing yet."
                : "No L\u2011ADA in this wallet yet. Mint some and this balance starts working the day the program opens."}
            </p>
          </>
        ) : (
          <>
            <p className="mt-5 max-w-[38ch] text-[15px] leading-[1.55] tracking-tighter text-dim">
              Connect a wallet to see your L&#8209;ADA position and what it will earn once the
              program opens.
            </p>
            <Link href="/stake" className="lava-pill lava-pill--ghost mt-6">
              Go to Stake to connect <span aria-hidden="true">↗</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

const PointsCalculator = () => {
  const [amount, setAmount] = useState<string>("1000");
  const parsed = Math.max(0, parseFloat(amount.replace(/[^0-9.]/g, "")) || 0);

  const rows = RATES.map((rate) => ({
    key: rate.key,
    title: rate.title,
    daily: parsed * rate.rate,
    monthly: parsed * rate.rate * 30,
  }));

  const format = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div data-reveal className="lava-panel w-full p-6 sm:p-7">
      <div className="relative z-[4]">
        <div className="flex items-center justify-between gap-4">
          <Slug>/estimate</Slug>
          <span className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
            Illustrative
          </span>
        </div>

        <label className="lava-well mt-5 flex items-center justify-between gap-4 p-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <TokenIcon symbol="LADA" size={38} />
            <span className="text-[15px] tracking-tighter text-dim">L&#8209;ADA</span>
          </span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            aria-label="L-ADA amount"
            className="tabular w-full max-w-[190px] bg-transparent text-right text-[28px] font-medium tracking-tightest outline-none"
          />
        </label>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {rows.map((row) => (
            <div key={row.key} className="lava-well p-4">
              <p className="font-mono-lava text-[11px] uppercase leading-[1.3] tracking-[0.02em] text-dim">
                {row.title}
              </p>
              <p className="tabular mt-2.5 text-[24px] font-medium leading-none tracking-tightest">
                {format(row.daily)}
                <span className="ml-1.5 text-[13px] font-normal text-dim">/ day</span>
              </p>
              <p className="tabular mt-1.5 text-[13px] text-dim">
                {format(row.monthly)} over 30 days
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[12.5px] leading-[1.5] text-dim">
          An estimate from the rates above, not a statement of your balance. Accrual begins when
          the program opens.
        </p>
      </div>
    </div>
  );
};

const Points = () => (
  <div className="flex min-h-screen flex-col">
    <Navigation />

    <main className="flex-1">
      {/* ---- hero ---- */}
      <section className="relative isolate overflow-hidden pb-[clamp(48px,7vw,88px)] pt-[clamp(112px,12vw,150px)]">
        <HeroGlow />

        <div className="shell relative z-10">
          {/* Centred stack, matching the Stake hero and the landing page: the
              mark leads, the copy sits under it. */}
          <div className="mx-auto flex max-w-[640px] flex-col items-center text-center">
            <div data-reveal className="flex justify-center">
              <SpinningCoin size={240} />
            </div>

            <div
              data-reveal
              style={{ ["--reveal-delay" as string]: "0.08s" }}
              className="mt-[clamp(32px,5vw,52px)] flex flex-col items-center"
            >
              <span className="inline-flex">
                <Slug>/points</Slug>
              </span>
              <h1 className="mt-5 text-[clamp(40px,6vw,72px)] font-medium leading-[1.02] tracking-tightest">
                Lava <span className="text-sheen">Points</span>
              </h1>
              <p className="mt-4 max-w-[46ch] text-[clamp(15px,1.4vw,18px)] leading-[1.55] tracking-tighter text-dim">
                A running record of who backed Lava early. Hold L&#8209;ADA, put it to work, and
                your position accrues points every day.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/stake" className="lava-pill">
                  Mint L&#8209;ADA <span aria-hidden="true">↗</span>
                </Link>
                <span className="lava-pill lava-pill--ghost pointer-events-none">
                  Program opening soon
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- earning rates ---- */}
      <Section>
        <div className="shell">
          <SectionIntro
            heading={
              <>
                Two ways to <span className="text-sheen">earn</span>
              </>
            }
          />

          <div className="mx-auto grid max-w-[900px] gap-4 sm:grid-cols-2">
            {RATES.map((rate, index) => (
              <div
                key={rate.key}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${index * 0.07}s` }}
                className="lava-card lava-card--soft flex flex-col gap-5 p-7"
              >
                <div className="relative z-[4] flex items-center justify-between gap-3">
                  <Slug>{rate.slug}</Slug>
                  {rate.key === "collateral" ? (
                    <img
                      src={FLUIDTOKENS_LOGO.src}
                      alt="FluidTokens"
                      className="h-6 w-auto max-w-[120px] object-contain opacity-80"
                    />
                  ) : (
                    <TokenIcon symbol="LADA" size={30} />
                  )}
                </div>

                <div className="relative z-[4]">
                  <p className="tabular text-[clamp(40px,5vw,56px)] font-medium leading-none tracking-tightest">
                    {rate.rate}
                    <span className="ml-2 align-middle font-mono-lava text-[12px] uppercase tracking-[0.02em] text-dim">
                      {rate.unit}
                    </span>
                  </p>
                  <h3 className="mt-4 text-[20px] font-medium tracking-tighter">{rate.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-[1.5] text-dim">{rate.copy}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-6 grid max-w-[900px] items-start gap-4 lg:grid-cols-2">
            <PointsBalance />
            <PointsCalculator />
          </div>
        </div>
      </Section>

      {/* ---- what points are for ---- */}
      <Section>
        <div className="shell">
          <div className="mx-auto max-w-[900px]">
            <SectionIntro
              heading={
                <>
                  What points are <span className="text-sheen">for</span>
                </>
              }
            />

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Priority access",
                  body: "First call on new vaults and token pairs as they come online, ahead of general release.",
                },
                {
                  label: "Protocol voice",
                  body: "Weight in the decisions that shape Lava: which assets it supports, and where the treasury points.",
                },
                {
                  label: "Whatever comes next",
                  body: "Lava is setting aside a portion of what the protocol generates for the people who bootstrapped it. Points are how that contribution gets measured.",
                },
              ].map((item, index) => (
                <div
                  key={item.label}
                  data-reveal
                  style={{ ["--reveal-delay" as string]: `${index * 0.06}s` }}
                  className="lava-panel p-6"
                >
                  <div className="relative z-[4]">
                    <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                      0{index + 1}
                    </p>
                    <h3 className="mt-3 text-[17px] font-medium tracking-tighter">{item.label}</h3>
                    <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <p
              data-reveal
              className="mx-auto mt-8 max-w-[60ch] text-center text-[13px] leading-[1.6] text-dim"
            >
              Rates and mechanics are not final and may change before the program opens. Points
              are a record of participation. They are not a token, carry no monetary value, and
              confer no entitlement.
            </p>
          </div>
        </div>
      </Section>
    </main>

    <Footer />
  </div>
);

export default Points;
