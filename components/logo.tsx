import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  dark?: boolean;
};

export function Logo({ dark = false }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="Officeworker — home"
      className="flex shrink-0 items-center transition-opacity duration-150 hover:opacity-80 active:opacity-60"
    >
      <Image
        src="/Officeworker-logo.png"
        alt=""
        width={927}
        height={188}
        priority
        className={`${dark ? "brightness-0 invert " : ""}h-12 w-auto`}
      />
    </Link>
  );
}
