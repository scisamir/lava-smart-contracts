import { Button } from "@/components/ui/button";

export const CTASection = () => {
  return (
  <section
    className="pt-12 pb-8 relative overflow-hidden bg-background"
    style={{ background: 'var(--Color, #000000)' }}
  >
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          GENERIC TITLE GOES <span className="text-gradient-lava">HERE</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
          Lorem ipsum dolor sit amet consectetur. Lacinia et euismod consequat at non vel. Etiam ac nullam elementum massa sagittis fermentum laoreet tortor ac. Vel semectus nunc ut lectus lectus pretium eget pulvinar. Pellentesque ornare iaculis pretium non libero.
        </p>
        <Button className="bg-gradient-lava hover:opacity-90 transition-opacity shadow-none text-lg px-8 py-6 rounded-none relative btn-lava">
          <span className="relative z-10" style={{ fontFamily: "Pixelify Sans, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial", }}>
            STAKE NOW
          </span>

          {/* corner pixels */}
          <span style={{ position: "absolute", width: 4, height: 4, right: 0, top: 0, background: "#FFFFFF", zIndex: 2 }} />
          <span style={{ position: "absolute", width: 4, height: 4, left: 0, top: 0, background: "#FFFFFF", zIndex: 2 }} />
          <span style={{ position: "absolute", width: 4, height: 4, right: 0, bottom: 0, background: "#FFFFFF", zIndex: 2 }} />
          <span style={{ position: "absolute", width: 4, height: 4, left: 0, bottom: 0, background: "#FFFFFF", zIndex: 2 }} />
        </Button>
      </div>
    </section>
  );
};
