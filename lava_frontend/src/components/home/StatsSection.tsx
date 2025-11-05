export const StatsSection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-3xl mx-auto">
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-2">TVL</p>
        <p className="text-4xl font-bold">$3,21M</p>
      </div>
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-2">APY</p>
        <p className="text-4xl font-bold">4,32%</p>
      </div>
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-2">Holders</p>
        <p className="text-4xl font-bold">2,325</p>
      </div>
    </div>
  );
};
