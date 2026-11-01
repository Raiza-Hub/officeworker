"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const FAQ_ITEMS = [
  {
    question: "Which Officeworker plan is right for my team?",
    answer:
      "Basic is a fit for teams that need up to 5 teams and core product tools. Business adds unlimited teams, private teams and guests, and advanced intelligence and integrations.",
  },
  {
    question: "How does per subject/term pricing work?",
    answer:
      "Basic is ₦10 per subject/term, and Business is ₦16 per subject/term. Both plans include the Free features listed on the pricing page.",
  },
  {
    question: "Do you offer a free trial?",
    answer:
      "Officeworker has a Free plan you can start with. You can move to Basic or Business when your team needs more features.",
  },
  {
    question: "Do you offer any discounts?",
    answer:
      "For questions about pricing for your team, contact the Officeworker team.",
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer:
      "Contact the Officeworker team for help with your subscription or cancellation.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "For refund questions, contact the Officeworker team with your account and billing details.",
  },
  {
    question: "What are your data privacy and security policies?",
    answer:
      "Contact the Officeworker team for the latest details about data privacy and security.",
  },
  {
    question: "I have more questions about Officeworker. How can I get in touch?",
    answer:
      "Reach out to the Officeworker team for help with plans, billing, or getting started.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const motionDuration = shouldReduceMotion ? 0 : 0.22;

  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="bg-white px-4 text-[#17181a] sm:px-6"
    >
      <div className="mx-auto w-full max-w-[1408px] px-4 pt-20 pb-16 sm:px-8 sm:pt-24 sm:pb-20 lg:px-12 lg:pt-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 grid gap-8 sm:mb-20 md:grid-cols-2 md:gap-16 lg:gap-24">
            <h2
              id="faq-title"
              className="m-0 text-[48px] leading-none font-medium tracking-[-0.055em] text-[#202126]"
            >
              FAQs
            </h2>
            <div className="max-w-[620px]">
              <p className="m-0 text-[24px] leading-[1.35] tracking-[-0.035em] text-[#36393f]">
                Straightforward answers about Officeworker plans, per-subject
                pricing, and getting started.
              </p>
            </div>
          </div>

          <div id="faq-questions" className="mx-auto max-w-[896px] scroll-mt-24">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openIndex === index;
              const triggerId = `faq-question-${index}`;
              const panelId = `faq-answer-${index}`;

              return (
                <div key={item.question} className="border-b border-[#dfe4eb]">
                  <h3 className="m-0">
                    <button
                      id={triggerId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="flex min-h-[88px] w-full cursor-pointer items-center justify-between gap-6 py-5 text-left text-[16px] leading-[1.3] font-medium text-[#36393f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30"
                    >
                      <span>{item.question}</span>
                      <motion.svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                        className="h-6 w-6 shrink-0 text-[#17181a]"
                      >
                        <path
                          d="M12 5v14M5 12h14"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </motion.svg>
                    </button>
                  </h3>
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={triggerId}
                    aria-hidden={!isOpen}
                    initial={false}
                    animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                    transition={{
                      height: {
                        duration: motionDuration,
                        ease: [0.23, 1, 0.32, 1],
                      },
                      opacity: {
                        duration: shouldReduceMotion ? 0 : 0.16,
                        ease: "easeOut",
                      },
                    }}
                    className="overflow-hidden"
                  >
                    <p className="m-0 max-w-[68ch] pb-8 pr-12 text-[16px] leading-[1.65] text-[#686b72]">
                      {item.answer}
                    </p>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
