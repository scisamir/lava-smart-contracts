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
import { fetchBackend } from "@/lib/backendClient";
import { SortGlyph, TableToolbar } from "@/components/table/TableChrome";

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

const RewardStack = ({ rewards }: { rewards: string[] }) => (
  <div className="flex items-center">
    {(rewards ?? []).slice(0, 3).map((reward, index) => (
      <img
        key={index}
        src={reward}
        alt=""
        className={`h-6 w-6 rounded-full object-cover shadow-[0_0_0_2px_#0d1116] ${
          index > 0 ? "-ml-2" : ""
        }`}
      />
    ))}
  </div>
);

export const ProtocolsTable = () => {
  const { data: markets = [] } = useQuery<Market[]>({
    queryKey: ["markets"],
    queryFn: async () => {
      const response = await fetchBackend("/markets");
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
    <div className="flex flex-col gap-6">
      <TableToolbar title="Farms" count={markets.length} />

      {/* DESKTOP TABLE */}
      <div data-reveal className="lava-panel hidden md:block">
        <div className="relative z-[4]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <span className="inline-flex items-center gap-1">Protocol <SortGlyph /></span>
                </TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">Borrow rate <SortGlyph /></span>
                </TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">Supply rate <SortGlyph /></span>
                </TableHead>
                <TableHead>Rewards</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">TVL <SortGlyph /></span>
                </TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">Category <SortGlyph /></span>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {markets.map((market, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Link href="/stake" className="flex items-center gap-3 transition-colors hover:text-[#ff9a4d]">
                      <img
                        src={market.logo}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                      <span className="font-medium">{market.name}</span>
                    </Link>
                  </TableCell>

                  <TableCell className="tabular">{market.borrowRate}</TableCell>
                  <TableCell className="tabular text-[#ffd9a8]">{market.supplyRate}</TableCell>
                  <TableCell><RewardStack rewards={market.rewards} /></TableCell>
                  <TableCell className="tabular">{market.tvl}</TableCell>
                  <TableCell><span className="lava-slug">{market.category}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="flex flex-col gap-3 md:hidden">
        {markets.map((market, index) => (
          <div key={index} data-reveal className="lava-panel p-4">
            <div className="relative z-[4] flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <img src={market.logo} alt="" className="h-9 w-9 rounded-full object-cover" />
                  <span className="text-[15px] font-medium tracking-tighter">{market.name}</span>
                </div>
                <span className="lava-slug">{market.category}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">Borrow rate</p>
                  <p className="tabular mt-1 text-[15px]">{market.borrowRate}</p>
                </div>
                <div>
                  <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">Supply rate</p>
                  <p className="tabular mt-1 text-[15px] text-[#ffd9a8]">{market.supplyRate}</p>
                </div>
                <div>
                  <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">TVL</p>
                  <p className="tabular mt-1 text-[15px]">{market.tvl}</p>
                </div>
                <div>
                  <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">Rewards</p>
                  <div className="mt-1"><RewardStack rewards={market.rewards} /></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
