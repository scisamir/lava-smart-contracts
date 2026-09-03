import {
  ADA_LOGO,
  FLUIDTOKENS_LOGO,
  LAVA_LOGO,
  SPLASH_LOGO,
  STRIKETOKENS_LOGO,
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
import { SortGlyph, TableToolbar } from "@/components/table/TableChrome";

const TOKEN_ICONS: Record<string, string | undefined> = {
  ADA: ADA_LOGO?.src,
  tStrike: STRIKETOKENS_LOGO?.src,
  tPulse: SPLASH_LOGO?.src,
  test: FLUIDTOKENS_LOGO?.src,
};

const getTokenIcon = (symbol?: string) =>
  TOKEN_ICONS[String(symbol ?? "").trim()] ?? LAVA_LOGO.src;

const normalizeAmount = (value: string | number, symbol?: string) => {
  const raw = Number(String(value ?? "0").replace(/,/g, ""));
  if (!Number.isFinite(raw)) return String(value ?? "0");

  const normalized = symbol === "ADA" || symbol === "LADA" ? raw / 1_000_000 : raw;
  return normalized.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/* Open vaults get an ember dot; anything else reads as dim. */
const StatusDot = ({ status }: { status?: string }) => {
  const isOpen = String(status ?? "").toLowerCase() === "open";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isOpen ? "bg-[#ff9a4d] shadow-[0_0_10px_rgba(255,154,77,0.9)]" : "bg-white/25"
        }`}
      />
      <span className={isOpen ? "" : "text-dim"}>{status}</span>
    </span>
  );
};

const TokenAmount = ({ value, symbol }: { value: string | number; symbol?: string }) => (
  <span className="inline-flex items-center gap-2">
    <img src={getTokenIcon(symbol)} alt="" className="h-5 w-5 shrink-0 object-contain" />
    <span className="tabular">
      {normalizeAmount(value, symbol)} <span className="text-dim">{symbol ?? ""}</span>
    </span>
  </span>
);

export const VaultsTable = () => {
  const { poolInfo, vaultsLoading } = useCardanoWallet();

  return (
    <div className="flex flex-col gap-6">
      <TableToolbar title="Vaults" count={poolInfo.length} />

      {/* DESKTOP TABLE */}
      <div data-reveal className="lava-panel hidden md:block">
        <div className="relative z-[4]">
          {vaultsLoading && (
            <div className="border-b border-white/[0.07] px-5 py-3 font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
              Loading vaults…
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead><span className="inline-flex items-center gap-1">Vault <SortGlyph /></span></TableHead>
                <TableHead><span className="inline-flex items-center gap-1">Score <SortGlyph /></span></TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="inline-flex items-center gap-1">Recent blocks <SortGlyph /></span></TableHead>
                <TableHead><span className="inline-flex items-center gap-1">stStake <SortGlyph /></span></TableHead>
                <TableHead><span className="inline-flex items-center gap-1">Staked <SortGlyph /></span></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {poolInfo.map((vault, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <span className="inline-flex items-center gap-3">
                      <img
                        src={vault.logo || LAVA_LOGO.src}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                      <span className="font-medium">{vault.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="tabular">{vault.score}</TableCell>
                  <TableCell><StatusDot status={vault.status} /></TableCell>
                  <TableCell className="tabular">{vault.recentBlocks}</TableCell>
                  <TableCell>
                    <TokenAmount value={vault.stStake} symbol={vault.tokenPair?.derivative} />
                  </TableCell>
                  <TableCell>
                    <TokenAmount value={vault.staked} symbol={vault.tokenPair?.base} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="flex flex-col gap-3 md:hidden">
        {vaultsLoading && (
          <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
            Loading vaults…
          </p>
        )}

        {poolInfo.map((vault, index) => (
          <div key={index} data-reveal className="lava-panel p-4">
            <div className="relative z-[4] flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2.5">
                  <img
                    src={vault.logo || LAVA_LOGO.src}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <span className="text-[15px] font-medium tracking-tighter">{vault.name}</span>
                </span>
                <StatusDot status={vault.status} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-[14px]">
                <div>
                  <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">Score</p>
                  <p className="tabular mt-1">{vault.score}</p>
                </div>
                <div>
                  <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">Recent blocks</p>
                  <p className="tabular mt-1">{vault.recentBlocks}</p>
                </div>
                <div>
                  <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">stStake</p>
                  <p className="mt-1">
                    <TokenAmount value={vault.stStake} symbol={vault.tokenPair?.derivative} />
                  </p>
                </div>
                <div>
                  <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">Staked</p>
                  <p className="mt-1">
                    <TokenAmount value={vault.staked} symbol={vault.tokenPair?.base} />
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
