import { Pencil } from "lucide-react";

function ProfilePictureRow() {
  return (
    <li className="flex h-[66px] items-center justify-between px-4">
      <span className="text-[13px] leading-none font-medium text-[#292a30]">
        Profile picture
      </span>
      <button
        type="button"
        aria-label="Change profile picture"
        className="inline-flex size-8 items-center justify-center rounded-full bg-[#00c3a1] text-[15px] leading-none font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 focus-visible:ring-offset-2"
      >
        AW
      </button>
    </li>
  );
}

function EmailRow() {
  return (
    <li className="flex h-[60px] items-center justify-between gap-3 px-4">
      <span className="text-[13px] leading-none font-medium text-[#292a30]">
        Email
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-[13px] leading-none text-[#303137]">
          wisdomadebola62@gmail.com
        </span>
        <button
          type="button"
          aria-label="Change email"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e9e9ec] text-[#6f727a] transition-colors hover:bg-[#dfdfe3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40"
        >
          <Pencil aria-hidden="true" className="size-3" strokeWidth={2} />
        </button>
      </div>
    </li>
  );
}

function ProfileFieldRow({
  id,
  label,
  helper,
  defaultValue,
  placeholder,
  rowHeight,
}: {
  id: string;
  label: string;
  helper?: string;
  defaultValue?: string;
  placeholder?: string;
  rowHeight: "h-[64px]" | "h-[65px]";
}) {
  return (
    <li className={`flex ${rowHeight} items-center justify-between gap-4 px-4 py-3`}>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <label
          htmlFor={id}
          className="text-[13px] leading-[16px] font-medium text-[#292a30]"
        >
          {label}
        </label>
        {helper && (
          <span className="text-[12px] leading-[15px] text-[#777a82]">
            {helper}
          </span>
        )}
      </div>
      <input
        id={id}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-8 w-[180px] max-w-[48%] shrink-0 rounded-[8px] border border-[#dedee2] bg-white px-3 text-[13px] leading-5 text-[#303137] outline-none placeholder:text-[#85878e] focus:border-[#b9bbc4] focus:ring-2 focus:ring-[#626bd9]/15"
      />
    </li>
  );
}

export function ProfileDetailsCard() {
  return (
    <section
      aria-label="Profile details"
      className="overflow-hidden rounded-[10px] bg-white"
    >
      <ul className="m-0 list-none divide-y divide-[#e5e5e8] p-0">
        <ProfilePictureRow />
        <EmailRow />
        <ProfileFieldRow
          id="profile-full-name"
          label="Full name"
          defaultValue="Adebola Wisdom"
          rowHeight="h-[64px]"
        />
        <ProfileFieldRow
          id="profile-title"
          label="Title"
          helper="Your job title or role"
          placeholder="Software engineer"
          rowHeight="h-[65px]"
        />
        <ProfileFieldRow
          id="profile-username"
          label="Username"
          helper="One word, like a nickname or first name"
          defaultValue="wisdomadebola62"
          rowHeight="h-[65px]"
        />
      </ul>
    </section>
  );
}
