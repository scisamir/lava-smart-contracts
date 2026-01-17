import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  LAVA_LOGO,
  PASHOV_LOGO,
  SPEARBIT_LOGO,
  ZENITH_LOGO,
  SSA_LOGO,
  CODE_ARENA_LOGO,
} from "@/lib/images";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { TOKEN_PAIRS } from "@/lib/types";

const vaults = [
  {
    name: "Hyperlend",
    logo: PASHOV_LOGO.src,
    score: "87.87",
    status: "Purring",
    recentBlocks: 453,
    stStake: "1,000",
    staked: "1,000",
  },
  {
    name: "Pendle",
    logo: SPEARBIT_LOGO.src,
    score: "87.87",
    status: "Purring",
    recentBlocks: 423,
    stStake: "1,000",
    staked: "1,000",
  },
  {
    name: "Project X",
    logo: ZENITH_LOGO.src,
    score: "87.87",
    status: "Purring",
    recentBlocks: 543,
    stStake: "1,000",
    staked: "1,000",
  },
  {
    name: "Valantis",
    logo: SSA_LOGO.src,
    score: "87.87",
    status: "Purring",
    recentBlocks: 543,
    stStake: "1,000",
    staked: "1,000",
  },
  {
    name: "Hydra",
    logo: CODE_ARENA_LOGO.src,
    score: "87.87",
    status: "Purring",
    recentBlocks: 213,
    stStake: "1,000",
    staked: "1,000",
  },
];

export const VaultsTable = () => {
  const { poolInfo } = useCardanoWallet();
  const poolInfoExtended = poolInfo.map((info) => {
    return {
      ...info,
      logo: SPEARBIT_LOGO.src,
      score: "87.87",
      status: info.isPoolOpen ? "Open" : "Closed",
      recentBlocks: 543,
      stStake: info.totalStAssetsMinted,
      staked: info.totalUnderlying,
      tokenPair: TOKEN_PAIRS.find((p) => p.derivative === info.name) ?? {
        base: "",
        derivative: "",
      },
    };
  });

  return (
    <div className="space-y-6">
      {/* HEADER + SEARCH */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Vaults</h2>

        <div className="relative w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search" className="pl-10 bg-muted/50 border-border rounded-none w-50 sm:w-64" />
        </div>
      </div>

      {/* TABLE WRAPPER */}
      <div className="border border-border bg-card/50 backdrop-blur-lg overflow-hidden rounded-none">
        <Table>
          {/* DESKTOP HEADER */}
          <TableHeader className="hidden md:table-header-group">
            <TableRow className="border-border bg-muted/50">
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Vault
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>

              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Score
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>

              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Status
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>

              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Recent Blocks
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>

              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  stStake
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>

              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Staked
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {poolInfoExtended.map((vault, index) => (
              <TableRow key={index} className="border-0 hover:bg-muted/50 transition-colors">
                {/* DESKTOP CELLS */}
                <TableCell className="hidden md:table-cell font-semibold">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                      <img
                        src={vault.logo || LAVA_LOGO.src}
                        alt={vault.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span>{vault.name}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {vault.score}
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-green-500" />
                    <span>{vault.status}</span>
                  </div>
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  {vault.recentBlocks}
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-lava flex items-center justify-center p-1">
                      <img
                        src={LAVA_LOGO.src}
                        alt="stADA"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span>
                      {vault.stStake}{" "}
                      <span className="text-muted-foreground">
                        {vault.tokenPair.derivative}
                      </span>
                    </span>
                  </div>
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-lava flex items-center justify-center p-1">
                      <img
                        src={LAVA_LOGO.src}
                        alt="stADA"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span>
                      {vault.staked}{" "}
                      <span className="text-muted-foreground">
                        {vault.tokenPair.base}
                      </span>
                    </span>
                  </div>
                </TableCell>

                {/* MOBILE VERSION */}
                <TableCell className="md:hidden px-4 py-6">
                  <div className="flex justify-between gap-6">
                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-4 text-sm w-1/2">
                      {/* Validator Name */}
                      <div>
                        <p className="text-xs text-muted-foreground">Vault</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                            <img
                              src={vault.logo || LAVA_LOGO.src}
                              alt={vault.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="font-semibold">{vault.name}</p>
                        </div>
                      </div>

                      {/* Status */}
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-green-500" />
                          <span>{vault.status}</span>
                        </div>
                      </div>

                      {/* stStake */}
                      <div>
                        <p className="text-xs text-muted-foreground">stStake</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-5 h-5 rounded-full bg-gradient-lava flex items-center justify-center p-1">
                            <img
                              src={LAVA_LOGO.src}
                              alt="stADA"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span>{vault.stStake} stADA</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="flex flex-col gap-4 text-sm w-1/2 text-right">
                      {/* Score */}
                      <div>
                        <p className="text-xs text-muted-foreground">Score</p>
                        <p className="font-semibold mt-1">{vault.score}</p>
                      </div>

                      {/* Recent Blocks */}
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Recent Blocks
                        </p>
                        <p className="mt-1">{vault.recentBlocks}</p>
                      </div>

                      {/* Staked */}
                      <div>
                        <p className="text-xs text-muted-foreground">Staked</p>
                        <div className="flex justify-end items-center gap-1 mt-1">
                          <div className="w-5 h-5 rounded-full bg-gradient-lava flex items-center justify-center p-1">
                            <img
                              src={LAVA_LOGO.src}
                              alt="stADA"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span>{vault.staked} ADA</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
