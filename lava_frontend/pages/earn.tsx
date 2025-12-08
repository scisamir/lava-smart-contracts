import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { LavaEarnCard } from "@/components/earn/LavaEarnCard";
import { ProtocolsTable } from "@/components/earn/ProtocolsTable";

const Earn = () => {
	return (
	<div className="min-h-screen">
			<Navigation />

			<section className="pt-32 pb-20">
				<div className="container mx-auto px-4">
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
						{/* Left Side - Title */}
						<div className="lg:col-span-2">
							<h1 className="text-5xl md:text-7xl font-bold mb-6">
								Yield <span className="text-gradient-lava">Farming</span>
							</h1>
							<div className="space-y-2 text-muted-foreground">
								<p>Use Lava assets in DeFi.</p>
								<p>Consider the added third party risks.</p>
							</div>
						</div>

						{/* Right Side - Lava Earn Card */}
						<LavaEarnCard />
					</div>

					{/* Protocols Table */}
					<ProtocolsTable />
				</div>
			</section>

			<Footer />
		</div>
	);
};

export default Earn;
