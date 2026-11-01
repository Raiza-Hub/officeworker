import { PricingSection } from "@/components/pricing-section";
import { FAQSection } from "@/components/faq-section";
import { ClosingCTA } from "@/components/closing-cta";

type IllustrationKind = "layers" | "agents" | "speed";

const FEATURES: {
  figure: string;
  title: string;
  description: string;
  illustration: IllustrationKind;
}[] = [
  {
    figure: "FIG 0.1",
    title: "Purpose-built",
    description:
      "Shaped by the practices and principles of world-class product teams.",
    illustration: "layers",
  },
  {
    figure: "FIG 0.2",
    title: "Powered by agents",
    description:
      "Designed for workflows shared by people and agents, from the first product brief to the shipped release.",
    illustration: "agents",
  },
  {
    figure: "FIG 0.3",
    title: "Designed for speed",
    description:
      "Reduce noise, keep momentum, and help teams ship with clarity and focus.",
    illustration: "speed",
  },
];

function FeatureIllustration({ kind }: { kind: IllustrationKind }) {
  return (
    <div
      role="img"
      aria-label={`${kind} illustration placeholder`}
      className="relative flex h-[clamp(15rem,26vw,20rem)] items-center justify-center text-[#777b83]/60"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 320 250"
        className="h-full w-full max-w-[340px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      >
        {kind === "layers" && (
          <g>
            <path d="m160 25 112 58-112 58L48 83 160 25Z" />
            <path d="M48 83v23l112 58 112-58V83" />
            <path d="M48 106v23l112 58 112-58v-23" />
            <path d="M48 129v23l112 58 112-58v-23" />
            <path d="M48 152v23l112 58 112-58v-23" />
            <path d="m111 82 49 25 49-25" className="opacity-50" />
            <ellipse cx="160" cy="82" rx="39" ry="17" className="opacity-60" />
            <path d="M127 88h66m-60 7h54m-45 7h36" className="opacity-60" />
          </g>
        )}

        {kind === "agents" && (
          <g>
            <path d="m160 25 56 29-56 29-56-29 56-29Z" />
            <path d="M104 54v47l56 29V83" />
            <path d="M216 54v47l-56 29" />
            <path d="m91 91 56 29-56 29-56-29 56-29Z" />
            <path d="M35 120v54l56 29v-54" />
            <path d="M147 120v54l-56 29" />
            <path d="m229 97 56 29-56 29-56-29 56-29Z" />
            <path d="M173 126v54l56 29v-54" />
            <path d="M285 126v54l-56 29" />
            <path d="m160 147 56 29-56 29-56-29 56-29Z" />
            <path d="M104 176v36l56 29v-36" />
            <path d="M216 176v36l-56 29" />
            <path d="m151 53 9 5 9-5-9-5-9 5Z" className="opacity-50" />
            <path d="m82 119 9 5 9-5-9-5-9 5Zm69 57 9 5 9-5-9-5-9 5Z" className="opacity-50" />
          </g>
        )}

        {kind === "speed" && (
          <g>
            <path d="m58 182 104-55 112 58-104 55-112-58Z" />
            <path d="m70 169 104-55 112 58" />
            <path d="m82 156 104-55 112 58" />
            <path d="m94 143 104-55 112 58" />
            <path d="m106 130 104-55 112 58" />
            <path d="m118 117 104-55 112 58" />
            <path d="m130 104 104-55 112 58" />
            <path d="m142 91 104-55 56 29" />
            <path d="M58 182v13l112 58v-13m-92-91v13l112 58v-13m-92-91v13l112 58v-13m-92-91v13l112 58v-13m-92-91v13l112 58v-13m-92-91v13l112 58v-13m-92-91v13l112 58v-13" className="opacity-55" />
          </g>
        )}
      </svg>
      <span className="absolute bottom-3 text-[10px] font-medium tracking-[0.06em] text-[#777b83]/70">
        Illustration placeholder
      </span>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex-1">
      <section
        className="flex min-h-[max(680px,calc(100svh-64px))] items-center border-b border-black/10 pt-16 pb-40 max-[700px]:min-h-[calc(100svh-64px)] max-[700px]:pt-12 max-[700px]:pb-32"
        aria-labelledby="home-hero-title"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h1
            id="home-hero-title"
            className="m-0 text-balance text-[clamp(3.1rem,5.2vw,4rem)] leading-[1.04] font-medium tracking-[-0.055em] text-[#17181a] max-[700px]:text-[clamp(2.75rem,10vw,4rem)] max-[700px]:leading-[1.06] max-[700px]:tracking-[-0.052em]"
          >
            <span className="block">The product development</span>
            <span className="block">system for teams and agents</span>
          </h1>

          <div className="mt-[42px] flex items-center justify-between gap-8 max-[700px]:mt-7 max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-5">
            <p className="m-0 max-w-[65ch] text-[15px] leading-[1.5] text-[#686b72]">
              Purpose-built for planning and building products. Designed for the AI era.
            </p>
            <p
              className="m-0 flex shrink-0 items-center gap-4 text-[15px] leading-[1.5] text-[#202126]"
              aria-label="New: Loops"
            >
              <span>New</span>
              <span className="inline-flex items-center gap-[7px] text-[#72757d]">
                Loops <span aria-hidden="true">→</span>
              </span>
            </p>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="product-principles-title"
        className="scroll-mt-20 border-b border-black/10 bg-white pt-20 pb-28 text-[#17181a] sm:pt-24 sm:pb-32"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2
            id="product-principles-title"
            className="mb-28 max-w-[1120px] text-balance text-[48px] leading-[1.05] font-medium tracking-[-0.055em] max-[700px]:mb-20"
          >
            <span className="text-[#202126]">A new species of product tool. </span>
            <span className="text-[#7b7e85]">
              Purpose-built for modern teams with AI workflows at its core,
              Officeworker sets a new standard for planning and building products.
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <article
                key={feature.figure}
                className={`border-b border-black/10 py-8 first:pt-0 last:border-b-0 last:pb-0 md:border-b-0 md:py-0 md:pl-8 md:first:border-l-0 md:first:pl-0 md:last:pr-0 ${
                  index > 0 ? "md:border-l md:border-black/10" : ""
                } ${index < FEATURES.length - 1 ? "md:pr-8" : ""}`}
              >
                <p className="m-0 font-mono text-[11px] tracking-[0.08em] text-[#858990]">
                  {feature.figure}
                </p>
                <FeatureIllustration kind={feature.illustration} />
                <h3 className="m-0 text-[15px] font-medium leading-6 text-[#202126]">
                  {feature.title}
                </h3>
                <p className="mb-0 mt-2 max-w-[38ch] text-[15px] leading-[1.55] text-[#686b72]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />
      <FAQSection />
      <ClosingCTA />
    </main>
  );
}
