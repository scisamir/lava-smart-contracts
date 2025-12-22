
export const StatsSection = () => {
  return (
  <div className="grid grid-cols-3 gap-8 mb-16 max-w-lg mx-auto">
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-2">TVL</p>
        <p className="text-4xl font-bold no-pixelify">$3,21M</p>
      </div>
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-2">APY</p>
        <p className="text-4xl font-bold no-pixelify">4,32%</p>
      </div>
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-2">Holders</p>
        <p className="text-4xl font-bold no-pixelify">2,325</p>
      </div>
    </div>
  );
};