import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { LAVA_LOGO } from "@/lib/images";
import portfolioGraphic from "@/assets/portfolio-graphic.png";

const Portfolio = () => {
	return (
		<div className="min-h-screen bg-background">
			<Navigation />

			<section className="pt-32 pb-20">
				<div className="container mx-auto px-4 max-w-6xl">
				{/* Net Worth Section with Graphic */}
				<div className="mb-12 flex items-start gap-8">
					<div className="flex-1">
						<p className="text-muted-foreground mb-2">Net Worth</p>
						<div className="flex items-baseline gap-4 mb-6">
							<h1 className="text-5xl md:text-6xl font-bold">$50,321.43</h1>
							<span className="text-xl text-muted-foreground">124,432.54 ADA</span>
						</div>

						{/* Stats Grid */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
							<div>
								<p className="text-sm text-muted-foreground mb-1">Total PnL</p>
								<p className="text-2xl font-semibold text-green-500">+$32.32</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground mb-1">24h Gain/Loss</p>
								<p className="text-2xl font-semibold text-green-500">1.32%</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground mb-1">Total Yield Earned</p>
								<p className="text-2xl font-semibold text-green-500">+$6.32</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground mb-1">Net APY</p>
								<p className="text-2xl font-semibold">4.32%</p>
							</div>
						</div>
					</div>
					
					{/* Desktop-only graphic */}
					<div className="hidden lg:block flex-shrink-0 -mb-32">
						<img 
							src={portfolioGraphic.src} 
							alt="Portfolio graphic" 
							className="w-[480px] h-auto"
						/>
					</div>
				</div>

					{/* Holdings Section */}
					<div>
						<h2 className="text-3xl font-bold mb-6">Holdings</h2>

						{/* Desktop Table */}
						<div className="hidden md:block">
							<Card className="bg-card border-border overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead className="border-b border-border">
											<tr>
												<th className="text-left px-4 py-3 text-sm text-muted-foreground font-medium">
													Asset
												</th>
												<th className="text-left px-4 py-3 text-sm text-muted-foreground font-medium">
													Value
												</th>
												<th className="text-left px-4 py-3 text-sm text-muted-foreground font-medium">
													24h Gain/Loss
												</th>
												<th className="text-center px-4 py-3 text-sm text-muted-foreground font-medium">
													24h Gain/Loss %
												</th>
											</tr>
										</thead>
										<tbody>
											{[
												{ value: "$10,433.12", change: "+$12.43", changePercent: "+1.43%", isPositive: true },
												{ value: "$10,433.12", change: "+$15.43", changePercent: "+1.43%", isPositive: true },
												{ value: "$10,433.12", change: "-$31.43", changePercent: "-1.43%", isPositive: false },
												{ value: "$10,433.12", change: "+$21.54", changePercent: "+1.43%", isPositive: true },
												{ value: "$10,433.12", change: "+$154.46", changePercent: "+1.43%", isPositive: true },
											].map((holding, index) => (
												<tr key={index} className="border-b border-border last:border-0">
													<td className="px-4 py-3">
														<div className="flex items-center gap-2">
															<img src={LAVA_LOGO.src} alt="stADA" className="w-6 h-6" />
															<span className="font-medium">1,000 <span className="text-muted-foreground">stADA</span></span>
														</div>
													</td>
													<td className="px-4 py-3 font-medium text-left">{holding.value}</td>
													<td className={`px-4 py-3 font-medium text-left ${holding.isPositive ? 'text-green-500' : 'text-red-500'}`}>
														{holding.change}
													</td>
													<td className={`px-4 py-3 font-medium text-center ${holding.isPositive ? 'text-green-500' : 'text-red-500'}`}>
														{holding.changePercent}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</Card>
						</div>

						{/* Mobile Cards */}
						<div className="md:hidden space-y-4">
							{[
								{ value: "$10,433.12", change: "+$12.43", changePercent: "+1.43%", isPositive: true },
								{ value: "$10,433.12", change: "+$15.43", changePercent: "+1.43%", isPositive: true },
								{ value: "$10,433.12", change: "-$31.43", changePercent: "-1.43%", isPositive: false },
								{ value: "$10,433.12", change: "+$21.54", changePercent: "+1.43%", isPositive: true },
							].map((holding, index) => (
								<Card key={index} className="bg-card border-border p-4">
									<div className="grid grid-cols-2 gap-4">
										{/* Row 1: Asset (left) | Value (right) */}
										<div>
											<div className="flex items-center gap-2">
												<img src={LAVA_LOGO.src} alt="stADA" className="w-6 h-6" />
												<span className="font-medium">1,000 <span className="text-muted-foreground">stADA</span></span>
											</div>
										</div>

										<div className="text-right">
											<p className="text-sm text-muted-foreground mb-1">Value</p>
											<p className="font-medium">{holding.value}</p>
										</div>

										{/* Row 2: 24h Gain/Loss (left) | 24h Gain/Loss % (right) */}
										<div>
											<p className="text-sm text-muted-foreground mb-1">24h Gain/Loss</p>
											<p className={`font-medium ${holding.isPositive ? 'text-green-500' : 'text-red-500'}`}>{holding.change}</p>
										</div>

										<div className="text-right">
											<p className="text-sm text-muted-foreground mb-1">24h Gain/Loss %</p>
											<p className={`font-medium ${holding.isPositive ? 'text-green-500' : 'text-red-500'}`}>{holding.changePercent}</p>
										</div>
									</div>
								</Card>
							))}
						</div>
					</div>
				</div>
			</section>

			<Footer />
		</div>
	);
};

export default Portfolio;