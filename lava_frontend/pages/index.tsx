import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StakingCard } from "@/components/home/StakingCard";
import { StatsSection } from "@/components/home/StatsSection";
import { ProtocolsSection } from "@/components/home/ProtocolsSection";
import { SecuritySection } from "@/components/home/SecuritySection";
import { CTASection } from "@/components/home/CTASection";
import { LAVA_WAVE } from "@/lib/images";

const Index = () => {
	return (
		<div className="min-h-screen bg-background">
			<Navigation />

			{/* Hero Section */}
			<section className="relative pt-32 pb-20 overflow-hidden">
				<div 
					className="absolute inset-0 opacity-30"
					style={{
						backgroundImage: `url(${LAVA_WAVE.src})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
					}}
				/>
        
				<div className="container mx-auto px-4 relative z-10">
					<div className="text-center max-w-4xl mx-auto mb-16">
						<h1 className="text-5xl md:text-7xl font-bold mb-6">
							Powering <span className="text-transparent bg-clip-text bg-gradient-lava">Liquid Staking</span>
							<br />on Cardano
						</h1>
					</div>

					<StatsSection />
					<StakingCard />
				</div>
			</section>

			<ProtocolsSection />
			<SecuritySection />
			<CTASection />

			<Footer />
		</div>
	);
};

export default Index;
