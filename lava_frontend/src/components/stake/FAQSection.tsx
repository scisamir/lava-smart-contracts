import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQSection = () => {
  const faqs = [
    {
      question: "Question text goes here",
      answer: "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer: "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer: "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer: "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer: "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer: "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto mt-20">
      <h2 className="text-4xl md:text-5xl font-bold mb-8 text-center">
        FREQUENTLY ASKED <span className="text-gradient-lava">QUESTIONS</span>
      </h2>
      
      {/* Controlled Accordion so we can render custom +/- toggles and behavior */}
      <Accordion type="single" collapsible className="space-y-4" value={undefined}>
        {faqs.map((faq, index) => {
          const id = `item-${index + 1}`;
          return (
            <AccordionItem
              key={index}
              value={id}
              className="bg-card/50 border border-border rounded-none px-6 backdrop-blur-sm"
            >
              <AccordionTrigger className="text-foreground hover:text-primary flex items-center justify-between">
                <span
                  className="pixelify"
                  style={{ fontFamily: 'Pixelify Sans, sans-serif' }}
                >
                  {faq.question}
                </span>
                {/* toggle rendered by the AccordionTrigger component */}
              </AccordionTrigger>

              <AccordionContent className="text-muted-foreground">
                {/* Show lorem ipsum when opened per request */}
                <p className="pixelify" style={{ fontFamily: 'Pixelify Sans, sans-serif' }}>
                  lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};
