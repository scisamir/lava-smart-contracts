import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionIntro } from "@/components/layout/Section";

/* Answers drawn from the Lava white paper (v2.0) and investor deck. Figures
   that could drift (APY, TVL, launch dates) are deliberately left out. */
const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is L-ADA?",
    answer:
      "A Cardano native token issued by the protocol against the ADA you deposit. One L-ADA is a proportional claim on the pool's underlying balance. As staking rewards flow in, the exchange rate rises and every L-ADA redeems for more ADA. Your balance never changes; its redemption value does.",
  },
  {
    question: "Can I use L-ADA in DeFi and still earn staking rewards?",
    answer:
      "Yes, and that is the whole point. On Cardano, ADA moved into a DEX or a lending market normally stops earning staking rewards. Because the yield lives in L-ADA's exchange rate rather than in a delegation, the staking exposure keeps running while the token is supplied as collateral, paired into liquidity, or split into principal and yield.",
  },
  {
    question: "Do I have to claim or compound anything?",
    answer:
      "No. There are no claim transactions, no compounding actions, no rebases, no manual rollovers, and no lockup imposed by Lava. Holding L-ADA is the entire user experience. The yield is in the token.",
  },
  {
    question: "What does it cost?",
    answer:
      "A flat 1 ADA to stake and 1 ADA to unstake. Cancelling a pending order costs only the standard network fee and returns your deposit in full. Holding or transferring L-ADA carries no protocol fee. Lava may retain a portion of staking rewards before they enter the pool; any such fee is already reflected in the APY shown, so the rate you see is the rate you receive.",
  },
  {
    question: "How long does staking or redeeming take?",
    answer:
      "Your order is created on-chain and picked up by an authorised batcher, typically within minutes. Batching processes many orders in one transaction, which spreads the network fee across everyone in it. A pending order has no time limit and can be cancelled at any point before it is processed, with no penalty.",
  },
  {
    question: "Which exchange rate do I get when I redeem?",
    answer:
      "The rate at the moment your order is processed, not the moment you submit it. The rate can only ever move up, because deposits and redemptions move the pool's totals proportionally and leave it unchanged; only incoming staking rewards shift it. So the rate you get is always at least as favourable as the one you saw when you submitted.",
  },
  {
    question: "Where does the yield come from?",
    answer:
      "Base Cardano staking rewards, plus pledge uplift. The pool's underlying ADA is delegated to Atrium-operated stake pools configured to carry meaningful operator pledge, which raises the reward rate up to Cardano's saturation cap. Rewards route back into the pool and lift the exchange rate for every holder proportionally, rather than paying out to any single delegator.",
  },
  {
    question: "Is Lava custodial, and has it been audited?",
    answer:
      "Lava is non-custodial: assets are held by on-chain validators, never by a team-controlled wallet. Authorised batchers are listed on-chain behind a multisig threshold and cannot redirect funds to themselves. UTxO Company audited the full validator set, with the report dated 23 March 2026. All 13 critical findings were resolved before mainnet deployment; two lower-severity items are acknowledged and scheduled for a future update. The full report is public.",
  },
  {
    question: "What are the risks?",
    answer:
      "All on-chain protocols carry residual smart-contract risk; an audit reduces it but cannot eliminate it. L-ADA also inherits the security properties of the staking integration behind it, and deploying L-ADA into other venues adds those protocols' risk on top. Pairing L-ADA against ADA in a pool introduces impermanent-loss drift as L-ADA appreciates, and borrowing against it introduces liquidation risk. Redemptions depend on available pool liquidity: normally immediate, though unusual demand can mean a brief wait. None of this is financial advice.",
  },
];

export const FAQSection = () => {
  return (
    <div className="mx-auto mb-16 mt-20 w-full max-w-3xl">
      <SectionIntro heading={<>Frequently asked <span className="text-sheen">questions</span></>} />

      <Accordion type="single" collapsible className="flex flex-col gap-2">
        {FAQS.map((faq, index) => (
          <AccordionItem
            key={faq.question}
            value={`item-${index}`}
            data-reveal
            style={{ ["--reveal-delay" as string]: `${index * 0.03}s` }}
          >
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
