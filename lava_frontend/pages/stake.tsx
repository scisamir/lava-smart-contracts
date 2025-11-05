import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StatsSection } from "@/components/home/StatsSection";
import { StakingInputCard } from "@/components/stake/StakingInputCard";
import { FAQSection } from "@/components/stake/FAQSection";
import { LAVA_WAVE } from "@/lib/images";

const Stake = () => {
	return (
		<div className="min-h-screen bg-background">
			<Navigation />

			{/* Hero Section */}
			<section className="relative pt-32 pb-20 overflow-hidden min-h-screen">
				<div 
					className="absolute inset-0 opacity-30"
					style={{
						backgroundImage: `url(${LAVA_WAVE.src})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
					}}
				/>
        
				<div className="container mx-auto px-4 relative z-10">
					<div className="text-center max-w-4xl mx-auto mb-12">
						<h1 className="text-5xl md:text-7xl font-bold mb-4">
							Liquid <span className="text-transparent bg-clip-text bg-gradient-lava">Staking</span>
						</h1>
						<p className="text-muted-foreground text-lg">Stake ADA and receive stADA</p>
					</div>

					<StatsSection />
					<StakingInputCard />
					<FAQSection />
				</div>
			</section>

			<Footer />
		</div>
	);
};

export default Stake;
