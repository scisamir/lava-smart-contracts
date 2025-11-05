import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const protocols = [
  { name: "Hyperlend", logo: "🌀", color: "bg-cyan-500" },
  { name: "Pendle", logo: "🌙", color: "bg-slate-400" },
  { name: "Project X", logo: "⚪", color: "bg-white" },
  { name: "Valantis", logo: "🦢", color: "bg-slate-300" },
  { name: "Hydra", logo: "💧", color: "bg-cyan-600" },
];

export const ProtocolsTable = () => {
  return (
    <Card className="bg-card/50 backdrop-blur-lg border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">
              <div className="flex items-center gap-1">
                Protocol <ChevronDown className="w-4 h-4" />
              </div>
            </TableHead>
            <TableHead className="text-muted-foreground">
              <div className="flex items-center gap-1">
                Borrow Rate <ChevronDown className="w-4 h-4" />
              </div>
            </TableHead>
            <TableHead className="text-muted-foreground">
              <div className="flex items-center gap-1">
                Supply Rate <ChevronDown className="w-4 h-4" />
              </div>
            </TableHead>
            <TableHead className="text-muted-foreground">Rewards</TableHead>
            <TableHead className="text-muted-foreground">
              <div className="flex items-center gap-1">
                TVL <ChevronDown className="w-4 h-4" />
              </div>
            </TableHead>
            <TableHead className="text-muted-foreground">
              <div className="flex items-center gap-1">
                Category <ChevronDown className="w-4 h-4" />
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {protocols.map((protocol, index) => (
            <TableRow 
              key={index} 
              className="border-border hover:bg-muted/50 transition-colors"
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${protocol.color} flex items-center justify-center`}>
                    <span className="text-xl">{protocol.logo}</span>
                  </div>
                  <span className="font-semibold">{protocol.name}</span>
                </div>
              </TableCell>
              <TableCell>0.05% APY</TableCell>
              <TableCell>0.05% APY</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <span className="text-lg">🪙</span>
                  <span className="text-lg">🔥</span>
                </div>
              </TableCell>
              <TableCell>$3.43M</TableCell>
              <TableCell>
                <span className="text-muted-foreground">DEX</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
