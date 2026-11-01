import Image from "next/image";
import Link from "next/link";

export function ClosingCTA() {
  return (
    <section
      id="get-started"
      aria-labelledby="closing-cta-title"
      className="flex min-h-[70svh] items-center justify-center border-b border-black/10 bg-white px-4 py-28 text-[#17181a] sm:px-6 sm:py-40 lg:py-52"
    >
      <div className="mx-auto w-full max-w-5xl text-center">
        <Image
          src="/officeworker-mark.png"
          alt=""
          width={226}
          height={166}
          className="mx-auto mb-8 h-16 w-auto"
        />
        <h2
          id="closing-cta-title"
          className="m-0 bg-[linear-gradient(to_bottom,#202126_0%,#202126_45%,#8b8f97_100%)] bg-clip-text text-balance text-[72px] leading-[1.12] font-medium tracking-[-0.06em] text-transparent max-[640px]:text-[clamp(2.5rem,10vw,3.75rem)]"
        >
          <span className="block">Try Officeworker now.</span>
        </h2>
        <Link
          href="/login"
          className="mt-14 inline-flex h-12 items-center justify-center rounded-full bg-[#202126] px-6 text-[16px] font-medium text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          Get started
        </Link>
        <nav
          aria-label="Social and legal links"
          className="mt-8 flex flex-col items-center gap-3 text-[14px] text-[#777b83]"
        >
          <div className="flex items-center gap-3">
            <Link href="#" className="transition-colors hover:text-[#202126]">
              X
            </Link>
            <span aria-hidden="true">•</span>
            <Link href="#" className="transition-colors hover:text-[#202126]">
              LinkedIn
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="#" className="transition-colors hover:text-[#202126]">
              Terms of Service
            </Link>
            <span aria-hidden="true">•</span>
            <Link href="#" className="transition-colors hover:text-[#202126]">
              Privacy Policy
            </Link>
          </div>
        </nav>
      </div>
    </section>
  );
}
