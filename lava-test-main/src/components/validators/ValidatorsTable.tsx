import { Input } from "@/components/ui/input";
import { Search, ChevronDown } from "lucide-react";
import { LAVA_LOGO } from "@/lib/images";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const validators = [
  { 
    name: "Hyperlend", 
    score: "87.87", 
    status: "Purring", 
    recentBlocks: 453,
    stStake: "1,000",
    staked: "1,000"
  },
  { 
    name: "Pendle", 
    score: "87.87", 
    status: "Purring", 
    recentBlocks: 423,
    stStake: "1,000",
    staked: "1,000"
  },
  { 
    name: "Project X", 
    score: "87.87", 
    status: "Purring", 
    recentBlocks: 543,
    stStake: "1,000",
    staked: "1,000"
  },
  { 
    name: "Valantis", 
    score: "87.87", 
    status: "Purring", 
    recentBlocks: 543,
    stStake: "1,000",
    staked: "1,000"
  },
  { 
    name: "Hydra", 
    score: "87.87", 
    status: "Purring", 
    recentBlocks: 213,
    stStake: "1,000",
    staked: "1,000"
  },
];

export const ValidatorsTable = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Validators</h2>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-10 bg-muted/50 border-border"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-lg overflow-hidden">

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Validator <ChevronDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Score <ChevronDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Status <ChevronDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Recent Blocks <ChevronDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  stStake <ChevronDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  Staked <ChevronDown className="w-4 h-4" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validators.map((validator, index) => (
              <TableRow 
                key={index} 
                className="border-border hover:bg-muted/50 transition-colors"
              >
                <TableCell className="font-semibold">{validator.name}</TableCell>
                <TableCell>{validator.score}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-green-500" />
                    <span>{validator.status}</span>
                  </div>
                </TableCell>
                <TableCell>{validator.recentBlocks}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-lava flex items-center justify-center p-1">
                      <img src={LAVA_LOGO.src} alt="stADA" className="w-full h-full object-contain" />
                    </div>
                    <span>{validator.stStake} <span className="text-muted-foreground">stADA</span></span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs">₳</span>
                    </div>
                    <span>{validator.staked} <span className="text-muted-foreground">ADA</span></span>
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
