import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import WorldMap from "@/components/WorldMap";
import { ValidatorHeader } from "@/components/validators/ValidatorHeader";
import { ValidatorsTable } from "@/components/validators/ValidatorsTable";

const Validators = () => {
	return (
		<div className="min-h-screen bg-background">
			<Navigation />

			<section className="pt-32 pb-20">
				<div className="container mx-auto px-4">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
						<ValidatorHeader />
            
						<div className="flex items-center justify-center">
							<WorldMap />
						</div>
					</div>

					<ValidatorsTable />
				</div>
			</section>

			<Footer />
		</div>
	);
};

export default Validators;
