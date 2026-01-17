import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  FLUIDTOKENS_LOGO,
  MINSWAP_LOGO,
  SPLASH_LOGO,
  LIQWID_LOGO,
  IAGON_LOGO,
  CIRCLE_LOGO,
} from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import Link from "next/link";

const protocols = [
  {
    name: "Hyperlend",
    logo: FLUIDTOKENS_LOGO.src,
    color: "bg-cyan-500",
    rewards: [MINSWAP_LOGO.src, SPLASH_LOGO.src, LIQWID_LOGO.src],
    tvl: "$3.43M",
    borrowRate: "0.05% APY",
    supplyRate: "0.05% APY",
    category: "DEX",
  },
  {
    name: "Pendle",
    logo: MINSWAP_LOGO.src,
    color: "bg-slate-400",
    rewards: [LIQWID_LOGO.src, IAGON_LOGO.src, CIRCLE_LOGO.src],
    tvl: "$2.11M",
    borrowRate: "0.07% APY",
    supplyRate: "0.03% APY",
    category: "Yield",
  },
  {
    name: "Project X",
    logo: SPLASH_LOGO.src,
    color: "bg-white",
    rewards: [FLUIDTOKENS_LOGO.src, MINSWAP_LOGO.src, SPLASH_LOGO.src],
    tvl: "$5.20M",
    borrowRate: "0.06% APY",
    supplyRate: "0.04% APY",
    category: "DEX",
  },
  {
    name: "Valantis",
    logo: LIQWID_LOGO.src,
    color: "bg-slate-300",
    rewards: [IAGON_LOGO.src, CIRCLE_LOGO.src, FLUIDTOKENS_LOGO.src],
    tvl: "$1.89M",
    borrowRate: "0.04% APY",
    supplyRate: "0.02% APY",
    category: "Lending",
  },
  {
    name: "Hydra",
    logo: IAGON_LOGO.src,
    color: "bg-cyan-600",
    rewards: [SPLASH_LOGO.src, MINSWAP_LOGO.src, LIQWID_LOGO.src],
    tvl: "$6.42M",
    borrowRate: "0.08% APY",
    supplyRate: "0.05% APY",
    category: "Lending",
  },
];

export const ProtocolsTable = () => {
  const { poolInfo } = useCardanoWallet();
  const poolInfoExtended = poolInfo.map((info) => {
    return {
      ...info,
      logo: FLUIDTOKENS_LOGO.src,
      color: "bg-cyan-600",
      rewards: [IAGON_LOGO.src, CIRCLE_LOGO.src, FLUIDTOKENS_LOGO.src],
      tvl: "$1.89M",
      borrowRate: "0.04% APY",
      supplyRate: "0.02% APY",
      category: "Yield",
    };
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Farm</h2>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search" className="pl-10 bg-muted/50 border-border rounded-none" />
        </div>
      </div>

      {/* DESKTOP TABLE */}
      <Card className="bg-card/50 backdrop-blur-lg border-border hidden md:block rounded-none">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/50">
              <TableHead>
                <div className="flex items-center gap-1">
                  Protocol
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  Borrow Rate
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  Supply Rate
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-center">Rewards</div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  TVL
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  Category
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {poolInfoExtended.map((p, index) => (
              <TableRow
                key={index}
                className="border-0 hover:bg-muted/50 transition-colors"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${p.color} flex items-center justify-center overflow-hidden`}
                    >
                      <img
                        src={p.logo}
                        alt={p.name}
                        className="w-8 h-8 object-cover rounded-full"
                      />
                    </div>
                    <Link href="/stake">
                      <span className="font-semibold ml-2">{p.name}</span>
                    </Link>
                  </div>
                </TableCell>

                <TableCell>{p.borrowRate}</TableCell>
                <TableCell>{p.supplyRate}</TableCell>

                <TableCell className="align-middle">
                  <div className="flex items-center justify-center">
                    <img
                      src={p.rewards[0]}
                      alt="reward-1"
                      className="w-6 h-6 rounded-full border-2 border-white"
                    />
                    <img
                      src={p.rewards[1]}
                      alt="reward-2"
                      className="-ml-2 w-6 h-6 rounded-full border-2 border-white"
                    />
                    <img
                      src={p.rewards[2]}
                      alt="reward-3"
                      className="-ml-2 w-6 h-6 rounded-full border-2 border-white"
                    />
                  </div>
                </TableCell>

                <TableCell>{p.tvl}</TableCell>

                <TableCell>
                  <span className="text-muted-foreground">{p.category}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* MOBILE CARDS */}
      <div className="space-y-4 md:hidden mt-6">
        {protocols.map((p, index) => (
          <Card
            key={index}
            className="p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex justify-between gap-6">
              {/* LEFT SIDE */}
              <div className="flex flex-col space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-10 h-10 rounded-full ${p.color} flex items-center justify-center overflow-hidden`}
                  >
                    <img
                      src={p.logo}
                      alt={p.name}
                      className="w-8 h-8 object-cover rounded-full"
                    />
                  </div>
                  <span className="font-semibold ml-1">{p.name}</span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Reward</p>
                  <div className="font-medium">
                    <div className="flex items-center">
                      <img
                        src={p.rewards[0]}
                        alt="reward-1"
                        className="w-6 h-6 rounded-full border-2 border-white"
                      />
                      <img
                        src={p.rewards[1]}
                        alt="reward-2"
                        className="-ml-2 w-6 h-6 rounded-full border-2 border-white"
                      />
                      <img
                        src={p.rewards[2]}
                        alt="reward-3"
                        className="-ml-2 w-6 h-6 rounded-full border-2 border-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">TVL</p>
                  <p className="font-medium">{p.tvl}</p>
                </div>
              </div>

              {/* RIGHT SIDE */}
              <div className="flex flex-col space-y-3 text-right">
                <div>
                  <p className="text-xs text-muted-foreground">Borrow Rate</p>
                  <p className="font-medium">{p.borrowRate}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Supply Rate</p>
                  <p className="font-medium">{p.supplyRate}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{p.category}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
