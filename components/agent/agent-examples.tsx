import { Box, Search, UsersRound, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Example = {
  title: string;
  descriptionLines: string[];
  icon: LucideIcon;
  prompt: string;
};

const examples: Example[] = [
  {
    title: "Create a new project",
    descriptionLines: ["Turn an idea into a", "well-scoped project"],
    icon: Box,
    prompt: "Help me turn an idea into a well-scoped project.",
  },
  {
    title: "Research a topic",
    descriptionLines: ["Research a topic across", "the activity backlog"],
    icon: Search,
    prompt: "Research a topic across the activity backlog.",
  },
  {
    title: "Set up new team",
    descriptionLines: [
      "Create a team that matches",
      "how your organization works",
    ],
    icon: UsersRound,
    prompt: "Help me set up a new team that fits how we work.",
  },
];

type AgentExamplesProps = {
  onSelect: (prompt: string) => void;
  onDismiss: () => void;
};

export function AgentExamples({ onSelect, onDismiss }: AgentExamplesProps) {
  return (
    <section aria-labelledby="agent-examples-heading" className="pt-[52px]">
      <div className="flex h-6 items-center justify-between px-4">
        <h2
          id="agent-examples-heading"
          className="m-0 text-[12px] leading-none font-medium text-[#777a82]"
        >
          Get started with some examples
        </h2>
        <button
          type="button"
          aria-label="Dismiss examples"
          onClick={onDismiss}
          className="inline-flex size-6 items-center justify-center rounded-md text-[#85878e] transition-colors hover:bg-[#f3f3f4] hover:text-[#404148] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/35"
        >
          <X aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 min-[1000px]:grid-cols-3">
        {examples.map((example) => {
          const Icon = example.icon;

          return (
            <button
              type="button"
              key={example.title}
              onClick={() => onSelect(example.prompt)}
              className="flex h-[136px] min-w-0 flex-col rounded-[9px] border border-[#e9e9eb] bg-transparent px-4 pt-3 text-left transition-[background-color,border-color] duration-100 hover:border-[#d9d9dc] hover:bg-[#f2f2f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/35"
            >
              <Icon aria-hidden="true" className="size-3.5 text-[#4e5159]" strokeWidth={2.1} />
              <span className="mt-8 block text-[13px] leading-4 font-medium text-[#28292e]">
                {example.title}
              </span>
              <span className="mt-1 block max-w-[198px] text-[12px] leading-[18px] text-[#777a82]">
                {example.descriptionLines.map((line) => (
                  <span className="block" key={line}>
                    {line}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
