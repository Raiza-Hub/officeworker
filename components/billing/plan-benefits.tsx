import { Check } from "lucide-react";

export const proBenefitColumns = [
  [
    "50+ students in spreadsheets",
    "Higher priority on workflow",
    "Restrict new user invitations",
  ],
  [
    "Unlimited file upload size",
    "Guided reviews",
    "Restrict agent invocation",
  ],
  ["Unlimited activities", "Third-party app management"],
];

export const basicBenefitColumns = [
  [
    "Up to 50 students in spreadsheets",
    "Standard priority on workflow",
    "Workspace collaboration",
  ],
  [
    "Standard file upload size",
    "Guided reviews",
    "Basic agent invocation",
  ],
  ["Activity tracking", "Standard app management"],
];

export function PlanBenefits({
  columns = proBenefitColumns,
}: {
  columns?: string[][];
} = {}) {
  return (
    <div className="grid grid-cols-3 gap-x-[3px] border-t border-[#eeeeef] px-2 pt-2 pb-[7px]">
      {columns.map((column, columnIndex) => (
        <ul className="m-0 flex min-w-0 list-none flex-col p-0" key={columnIndex}>
          {column.map((benefit) => (
            <li
              className="flex min-h-[22.5px] min-w-0 items-start gap-1.5 px-2 py-1 text-[12px] leading-[15px] font-[450] text-[#686b73]"
              key={benefit}
            >
              <Check
                aria-hidden="true"
                className="mt-0.5 size-3 shrink-0 text-[#6876df]"
                strokeWidth={2.5}
              />
              <span className="min-w-0 flex-1 break-words">{benefit}</span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
