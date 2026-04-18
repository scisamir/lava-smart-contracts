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

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

type Market = {
  name: string;
  logo: string;
  color: string;
  rewards: string[];
  tvl: string;
  borrowRate: string;
  supplyRate: string;
  category: string;
};

export const ProtocolsTable = () => {
  const { data: markets = [] } = useQuery<Market[]>({
    queryKey: ["markets"],
    queryFn: async () => {
      const backendBaseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/lava-vaults\/?$/, "") ||
        "https://0lth59w8rl.execute-api.us-east-1.amazonaws.com/prod";

      const response = await fetch(`${backendBaseUrl}/markets`);
      if (!response.ok) {
        throw new Error(`Failed to fetch markets: ${response.status}`);
      }

      const data = await response.json();
      return (Array.isArray(data?.markets) ? data.markets : []) as Market[];
    },
    staleTime: 2 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Farms</h2>
          <div className="relative w-28 sm:w-48 md:w-64 lg:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search" className="pl-10 bg-muted/50 border-border rounded-none w-full" />
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
            {markets.map((p, index) => (
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
        {markets.map((p, index) => (
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
