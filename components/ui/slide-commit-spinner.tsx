export function Spinner({ size }: { size: number }) {
  return (
    <svg
      className="motion-safe:animate-[slide-commit-spin_1s_linear_infinite] motion-reduce:animate-[slide-commit-breathe_1.4s_ease-in-out_infinite]"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeOpacity="0.25"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
