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
      answer:
        "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer:
        "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer:
        "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer:
        "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer:
        "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
    {
      question: "Question text goes here",
      answer:
        "Answer text goes here. This is placeholder content that explains the answer to the question above.",
    },
  ];

  return (
    <div className="faq-section max-w-3xl mx-auto mt-20 mb-16">
      <h2 className="text-4xl md:text-5xl font-bold mb-8 text-center">
        FREQUENTLY ASKED <span className="text-gradient-lava">QUESTIONS</span>
      </h2>

      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="border-0 rounded-none faq-accordion-item"
          >
            <AccordionTrigger
              className={`px-6 py-5 flex items-center justify-between hover:no-underline text-white font-[Pixelify Sans] font-normal text-[18px] leading-[150%] tracking-[0%] bg-transparent`}
            >
              <span className="pixelify ml-3">{faq.question}</span>
            </AccordionTrigger>

            <AccordionContent
              className={`px-6 pb-5 font-[Pixelify Sans] font-normal text-[18px] leading-[150%] tracking-[0%] text-white bg-transparent`}
            >
              <span className="pixelify">{faq.answer}</span>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
