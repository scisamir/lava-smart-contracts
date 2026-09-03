import type { CSSProperties } from "react";
import { PageHeading, Stat } from "@/components/layout/Section";

export const ValidatorHeader = () => (
  <div>
    <PageHeading
      eyebrow="/vaults"
      title={
        <>
          Lava <span className="text-sheen">vaults</span>
        </>
      }
    >
      Every vault is a stake pool the protocol delegates through. Deposits are spread across the
      set, so no single operator holds the position, and the derivative token stays fungible
      whichever vault backs it.
    </PageHeading>

    <div
      data-reveal
      style={{ "--reveal-delay": "0.07s" } as CSSProperties}
      className="mt-10 grid grid-cols-2 gap-8"
    >
      <Stat label="Total Lava stake" value={<>12,432 <span className="text-dim">ADA</span></>} />
      <Stat label="Block height" value="132,543,321" />
    </div>
  </div>
);
