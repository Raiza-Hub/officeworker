import Image from "next/image";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-app-bg px-6 py-12">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-[376px] text-center"
      >
        <Image
          src="/officeworker-mark.png"
          alt="Officeworker"
          width={226}
          height={166}
          priority
          className="mx-auto h-12 w-auto"
        />

        <h1
          id="login-title"
          className="mx-auto mt-8 h-[22px] w-[288px] max-w-full text-[18px] leading-normal font-medium tracking-[-0.025em] text-[#191a1d]"
        >
          Create your workspace
        </h1>

        <p className="mx-auto mt-2 w-[288px] max-w-full text-[13px] leading-[19.5px] text-[#777981]">
          Sign in or create an account to continue.
        </p>

        <div className="mt-7">
          <GoogleSignInButton />
        </div>

        <p className="mx-auto mt-12 h-[58.5px] w-[288px] max-w-full text-[13px] leading-[19.5px] font-[450] tracking-normal text-[#777981]">
          By continuing, you agree to our
          <br />
          <span className="text-[#45474e]">Terms of Service</span>,{" "}
          <span className="text-[#45474e]">Privacy Policy</span>,
          <br />
          and <span className="text-[#45474e]">Data Processing Agreement</span>.
        </p>
      </section>
    </main>
  );
}
