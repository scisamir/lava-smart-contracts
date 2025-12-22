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
      
      <Accordion type="single" collapsible className="space-y-4">
        {faqs.map((faq, index) => (
          <AccordionItem 
            key={index}
            value={`item-${index + 1}`} 
            className="bg-card/50 border border-border rounded-lg px-6 backdrop-blur-sm"
          >
            <AccordionTrigger className="text-foreground hover:text-primary">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
