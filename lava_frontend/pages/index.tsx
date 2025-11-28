import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StakingCard } from "@/components/home/StakingCard";
import { StatsSection } from "@/components/home/StatsSection";
import { ProtocolsSection } from "@/components/home/ProtocolsSection";
import { SecuritySection } from "@/components/home/SecuritySection";
import { CTASection } from "@/components/home/CTASection";
import { LAVA_WAVE } from "@/lib/images";
import { OrderList } from "@/components/home/OrderList";
import { useEffect, useState } from "react";
import { fetchUserOrders } from "@/e2e/utils";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { UserOrderType } from "@/lib/types";

const Index = () => {
	const { blockchainProvider, walletAddress } = useCardanoWallet();
	const [orders, setOrders] = useState<UserOrderType[]>([]);

	useEffect(() => {
		if (blockchainProvider) {
			const awaitFetchUserOrders = async () => {
				const userOrders = await fetchUserOrders(blockchainProvider, walletAddress);
				setOrders(userOrders);
			}

			awaitFetchUserOrders();
		}
	});

	return (
		<div className="index-container bg-background flex flex-col">
				<Navigation />

				<div className="flex-1">
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
					<OrderList orders={orders} />
				</div>
			</section>

				<ProtocolsSection />
				<SecuritySection />
				<CTASection />
			</div>

			<Footer />

			<style jsx>{`
				.index-container {
					/* default (desktop) exact height requested */
					min-height: 2645.12px;
				}

				/* mobile: apply the requested mobile height */
				@media (max-width: 767px) {
					.index-container {
						min-height: 2725.25px;
					}
				}
			`}</style>
		</div>
	);
};

export default Index;
