"use client";

import { Card } from "@/components/ui/card";

const protocols = [
  {
    name: "Minswap",
    reward: "8.4%",
    tvl: "$5.2M",
    borrowRate: "4.8%",
    supplyRate: "2.1%",
    category: "DEX",
  },
  {
    name: "Liqwid",
    reward: "6.2%",
    tvl: "$3.9M",
    borrowRate: "5.6%",
    supplyRate: "3.4%",
    category: "Lending",
  },
  {
    name: "Indigo",
    reward: "7.1%",
    tvl: "$2.4M",
    borrowRate: "3.9%",
    supplyRate: "1.8%",
    category: "Synthetic Assets",
  },
];

export function ProtocolsTable() {
  return (
    <div className="mt-10">
      {/* MOBILE CARDS */}
      <div className="space-y-4 md:hidden">
        {protocols.map((p, index) => (
          <Card
            key={index}
            className="p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex justify-between gap-6">
              {/* LEFT SIDE */}
              <div className="flex flex-col space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-semibold">{p.name}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Reward</p>
                  <p className="font-medium">{p.reward}</p>
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

      {/* DESKTOP TABLE */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left">
            <thead className="bg-muted/20">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Reward</th>
                <th className="p-4">TVL</th>
                <th className="p-4">Borrow Rate</th>
                <th className="p-4">Supply Rate</th>
                <th className="p-4">Category</th>
              </tr>
            </thead>
            <tbody>
              {protocols.map((p, index) => (
                <tr
                  key={index}
                  className="border-t border-border hover:bg-muted/10 transition"
                >
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4">{p.reward}</td>
                  <td className="p-4">{p.tvl}</td>
                  <td className="p-4">{p.borrowRate}</td>
                  <td className="p-4">{p.supplyRate}</td>
                  <td className="p-4">{p.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
