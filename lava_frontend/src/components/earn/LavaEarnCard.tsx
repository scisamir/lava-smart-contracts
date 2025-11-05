import { Card } from "@/components/ui/card";
import { LAVA_LOGO } from "@/lib/images";

export const LavaEarnCard = () => {
  return (
    <Card className="bg-card/80 backdrop-blur-lg border-border shadow-glow-md p-6">
      <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-lava flex items-center justify-center shadow-glow p-2">
          <img src={LAVA_LOGO.src} alt="Lava" className="w-full h-full object-contain" />
        </div>
        <h3 className="text-2xl font-bold">
          Lava <span className="text-transparent bg-clip-text bg-gradient-lava">Earn</span>
        </h3>
      </div>
      
      <p className="text-muted-foreground text-sm mb-6">
        Lorem ipsum dolor sit amet consectetur. Lacinia et euismod consequat sit non vel. Enim ac nullam elementum massa sagittis.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-primary text-xs mb-1">APY</p>
          <p className="text-2xl font-bold">6.3%</p>
        </div>
        <div>
          <p className="text-primary text-xs mb-1">TVL</p>
          <p className="text-2xl font-bold">$32.43M</p>
        </div>
        <div>
          <p className="text-primary text-xs mb-1">Infra</p>
          <p className="text-lg font-semibold">Veda</p>
        </div>
        <div>
          <p className="text-primary text-xs mb-1">Rewards</p>
          <div className="flex items-center gap-1">
            <span className="text-lg">🪙</span>
            <span className="text-lg">🔥</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
