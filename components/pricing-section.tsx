import Link from "next/link";

const PLANS = [
  {
    name: "Basic",
    price: "₦10",
    features: [
      "All Free features +",
      "5 teams",
      "Unlimited activities",
      "Unlimited file uploads",
      "Admin roles",
      "Loops",
    ],
  },
  {
    name: "Business",
    price: "₦16",
    features: [
      "All Basic features +",
      "Unlimited teams",
      "Private teams and guests",
      "Triage Intelligence",
      "Code Intelligence",
      "Product insights",
      "Customer requests",
      "Zendesk and Intercom integrations",
    ],
  },
];

function FeatureCheck() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#e2e4e8] text-[#36393f]"
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
        <path
          d="m2.5 6.2 2.2 2.1 4.8-4.7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function PricingSection() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="scroll-mt-20 border-b border-black/10 bg-white py-20 text-[#17181a] sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-16 grid gap-8 sm:mb-20 md:grid-cols-2 md:gap-16 lg:gap-24">
          <h2
            id="pricing-title"
            className="m-0 text-[48px] leading-none font-medium tracking-[-0.055em] text-[#202126]"
          >
            Pricing
          </h2>
          <div className="max-w-[620px]">
            <p className="m-0 text-[24px] leading-[1.35] tracking-[-0.035em] text-[#36393f]">
              Simple plans for teams to organize product work, collaborate with
              agents, and ship with clarity.
            </p>
          </div>
        </div>

        <div
          id="pricing-plans"
          className="grid scroll-mt-24 grid-cols-1 divide-y divide-black/10 md:grid-cols-2 md:divide-x md:divide-y-0"
        >
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              aria-labelledby={`plan-${plan.name.toLowerCase()}-title`}
              className="flex flex-col py-8 first:pt-0 last:pb-0 md:py-0 md:px-8 md:first:pl-0 md:last:pr-0"
            >
              <h3
                id={`plan-${plan.name.toLowerCase()}-title`}
                className="m-0 text-[24px] leading-8 font-medium tracking-[-0.03em] text-[#202126]"
              >
                {plan.name}
              </h3>

              <p className="mb-6 mt-2 flex items-baseline gap-2 border-b border-black/10 pb-5 text-[15px] text-[#777b83]">
                <span className="text-[21px] font-medium tracking-[-0.03em] text-[#202126]">
                  {plan.price}
                </span>
                <span>per subject/term</span>
              </p>

              <ul className="mb-10 mt-7 flex-1 space-y-4 p-0 text-[14px] leading-6 text-[#44474d]">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <FeatureCheck />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#202126] px-5 text-[14px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                Get started
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
