import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StatsSection } from "@/components/home/StatsSection";
import { StakingInputCard } from "@/components/stake/StakingInputCard";
import { FAQSection } from "@/components/stake/FAQSection";
const Stake = () => {
	return (
	<div className="min-h-screen">
			<Navigation />

			{/* Hero Section */}
			<section className="pt-32 pb-20">
        
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
