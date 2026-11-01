import {
  ArrowUp,
  ChevronDown,
  Package,
  Paperclip,
} from "lucide-react";

type AgentComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function AgentComposer({ value, onChange, onSubmit }: AgentComposerProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="relative z-10 w-full"
    >
      <div className="flex h-[104px] flex-col rounded-[11px] border border-[#e7e7e9] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.035)] transition-[border-color,box-shadow] focus-within:border-[#d9dae0] focus-within:shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <textarea
          aria-label="Ask Linear"
          placeholder="Ask Linear..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-0 flex-1 resize-none bg-transparent text-[15px] leading-6 text-[#25262b] outline-none placeholder:text-[#85878e]"
        />
        <div className="flex h-6 shrink-0 items-center justify-between">
          <button
            type="button"
            aria-label="Skills"
            className="inline-flex h-6 items-center gap-1.5 rounded-full px-1 text-[12px] font-medium text-[#686b73] transition-colors hover:bg-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/35"
          >
            <Package aria-hidden="true" className="size-3.5" strokeWidth={2.15} />
            Skills
            <ChevronDown aria-hidden="true" className="size-3" strokeWidth={2} />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Attach a file"
              className="inline-flex size-7 items-center justify-center rounded-full text-[#71747c] transition-colors hover:bg-[#f3f3f4] hover:text-[#303137] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/35"
            >
              <Paperclip aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </button>
            <button
              type="submit"
              aria-label="Send prompt"
              className="inline-flex size-7 items-center justify-center rounded-full bg-[#626bd9] text-white transition-[background-color,transform] duration-100 hover:bg-[#555fc9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 focus-visible:ring-offset-2 active:scale-95"
            >
              <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
