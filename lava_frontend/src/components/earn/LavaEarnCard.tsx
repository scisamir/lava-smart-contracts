import { Card } from "@/components/ui/card";
import { LAVA_LOGO, FLUIDTOKENS_LOGO, MINSWAP_LOGO, SPLASH_LOGO } from "@/lib/images";

export const LavaEarnCard = () => {
  return (
    <Card className="bg-card/80 backdrop-blur-lg border-border shadow-glow-md p-6">
      <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-lava flex items-center justify-center shadow-glow p-2">
          <img src={LAVA_LOGO.src} alt="Lava" className="w-full h-full object-contain" />
        </div>
        <h3 className="text-2xl font-bold">
          Lava <span className="text-gradient-lava">Earn</span>
        </h3>
      </div>
      
      <p className="text-muted-foreground text-sm mb-6">
        Lorem ipsum dolor sit amet consectetur. Lacinia et euismod consequat sit non vel. Enim ac nullam elementum massa sagittis.
      </p>

      <div className="grid grid-cols-4 gap-4 text-center items-center">
        <div className="flex flex-col items-center">
          <p className="text-primary text-xs mb-1">APY</p>
          <p className="text-2xl font-bold">6.3%</p>
        </div>

        <div className="flex flex-col items-center">
          <p className="text-primary text-xs mb-1">TVL</p>
          <p className="text-2xl font-bold">$32.43M</p>
        </div>

        <div className="flex flex-col items-center">
          <p className="text-primary text-xs mb-1">Infra</p>
          <p className="text-2xl font-semibold">Veda</p>
        </div>

        <div className="flex flex-col items-center">
          <p className="text-primary text-xs mb-1">Rewards</p>
          <div className="flex items-center justify-center">
            <img src={FLUIDTOKENS_LOGO.src} alt="r1" className="w-6 h-6 rounded-full border-2 border-white object-cover" />
            <img src={MINSWAP_LOGO.src} alt="r2" className="-ml-2 w-6 h-6 rounded-full border-2 border-white object-cover" />
            <img src={SPLASH_LOGO.src} alt="r3" className="-ml-2 w-6 h-6 rounded-full border-2 border-white object-cover" />
          </div>
        </div>
      </div>
    </Card>
  );
};
