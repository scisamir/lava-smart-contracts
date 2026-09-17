
export const StatsSection = () => {
  return (
    <div className="w-full max-w-[644px] mx-auto grid grid-cols-3 sm:grid-cols-3 gap-4 mb-16 px-2 sm:px-0">
      <div className="text-center">
        <p className="text-white/70 text-xs sm:text-sm mb-1 font-medium">TVL</p>
        <p className="text-lg sm:text-4xl font-medium no-pixelify">$3,21M</p>
      </div>
      <div className="text-center">
        <p className="text-white/70 text-xs sm:text-sm mb-1 font-medium">APY</p>
        <p className="text-lg sm:text-4xl font-medium no-pixelify">4,32%</p>
      </div>
      <div className="text-center">
        <p className="text-white/70 text-xs sm:text-sm mb-1 font-medium">Holders</p>
        <p className="text-lg sm:text-4xl font-medium no-pixelify">2,325</p>
      </div>
    </div>
  );
};