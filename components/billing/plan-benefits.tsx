import { Check } from "lucide-react";

const benefitColumns = [
  ["5 teams", "Admin roles", "Restrict new user invitations"],
  [
    "Unlimited file upload size",
    "Guided reviews",
    "Restrict agent invocation to ...",
  ],
  ["Unlimited issues", "Third-party app management"],
];

export function PlanBenefits() {
  return (
    <div className="grid grid-cols-3 gap-x-[3px] border-t border-[#eeeeef] px-2 pt-2 pb-[7px]">
      {benefitColumns.map((column, columnIndex) => (
        <ul className="m-0 flex min-w-0 list-none flex-col p-0" key={columnIndex}>
          {column.map((benefit) => (
            <li
              className="flex h-[22.5px] min-w-0 items-center gap-1 px-2 py-1 text-[12px] leading-[14.5px] font-[450] text-[#686b73]"
              key={benefit}
            >
              <Check
                aria-hidden="true"
                className="size-3 shrink-0 text-[#6876df]"
                strokeWidth={2.5}
              />
              <span className="truncate">{benefit}</span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
