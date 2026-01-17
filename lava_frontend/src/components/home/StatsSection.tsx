
export const StatsSection = () => {
  return (
    <div className="grid grid-cols-3 gap-8 mb-16 mx-auto" style={{ width: 644 }}>
      <div className="text-center">
        <p className="text-white/70 text-sm mb-2" style={{ fontWeight: 500 }}>TVL</p>
        <p className="text-4xl font-medium no-pixelify" style={{ fontSize: 32, fontWeight: 500 }}>$3,21M</p>
      </div>
      <div className="text-center">
        <p className="text-white/70 text-sm mb-2" style={{ fontWeight: 500 }}>APY</p>
        <p className="text-4xl font-medium no-pixelify" style={{ fontSize: 32, fontWeight: 500 }}>4,32%</p>
      </div>
      <div className="text-center">
        <p className="text-white/70 text-sm mb-2" style={{ fontWeight: 500 }}>Holders</p>
        <p className="text-4xl font-medium no-pixelify" style={{ fontSize: 32, fontWeight: 500 }}>2,325</p>
      </div>
    </div>
  );
};