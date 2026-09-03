import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/* Shared chrome for the two data tables, so Earn and Vaults stay in step. */

export const SortGlyph = () => (
  <svg className="h-3.5 w-3.5 text-white/25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const TableToolbar = ({
  title,
  count,
  onSearch,
}: {
  title: string;
  count?: number;
  onSearch?: (value: string) => void;
}) => (
  <div data-reveal className="flex flex-wrap items-center justify-between gap-4">
    <h2 className="flex items-center gap-3 text-[clamp(24px,2.6vw,32px)] font-medium tracking-tightest">
      {title}
      {count !== undefined && <span className="lava-slug">{count}</span>}
    </h2>

    <div className="relative w-full max-w-[320px] sm:w-auto sm:min-w-[240px]">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
      <Input
        placeholder="Search"
        aria-label={`Search ${title.toLowerCase()}`}
        className="pl-11"
        onChange={(event) => onSearch?.(event.target.value)}
      />
    </div>
  </div>
);
