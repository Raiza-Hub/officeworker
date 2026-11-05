import { UploadDocumentsButton } from "@/components/documents/upload-documents-button";

const gridCells = Array.from({ length: 32 }, (_, index) => index);

function SlackMark() {
  return (
    <span aria-hidden="true" className="relative block size-9">
      <span className="absolute left-[15px] top-0 h-[14px] w-[7px] rounded-full bg-[#36c5f0]" />
      <span className="absolute left-0 top-[15px] h-[7px] w-[14px] rounded-full bg-[#2eb67d]" />
      <span className="absolute bottom-0 right-[15px] h-[14px] w-[7px] rounded-full bg-[#e01e5a]" />
      <span className="absolute bottom-[15px] right-0 h-[7px] w-[14px] rounded-full bg-[#ecb22e]" />
      <span className="absolute left-[15px] top-[15px] h-[7px] w-[7px] rounded-full bg-[#36c5f0]" />
      <span className="absolute bottom-[15px] left-[15px] h-[7px] w-[7px] rounded-full bg-[#2eb67d]" />
      <span className="absolute bottom-[15px] right-[15px] h-[7px] w-[7px] rounded-full bg-[#e01e5a]" />
      <span className="absolute right-[15px] top-[15px] h-[7px] w-[7px] rounded-full bg-[#ecb22e]" />
    </span>
  );
}

function NotionMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 42 46" className="size-10">
      <path
        d="M8 7.5 29.5 6l7 5.5v25L15 39l-7-5.5v-26Z"
        fill="white"
        stroke="#111217"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="m29.5 6 7 5.5-7 1.5V6Z"
        fill="white"
        stroke="#111217"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M17 15v16m0-16 10 15m0-15v15"
        fill="none"
        stroke="#111217"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DocumentEmptyState() {
  return (
    <div className="flex min-h-[500px] w-full items-center justify-center overflow-hidden px-4">
      <div className="-translate-y-2 flex w-full max-w-[680px] flex-col items-center text-center">
        <div
          aria-label="Knowledge base image grid"
          className="relative aspect-[2/1] w-[min(360px,82vw)]"
        >
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-4 border-r border-b border-[#e5e5e7]">
            {gridCells.map((cell) => (
              <span
                key={cell}
                aria-hidden="true"
                className="border-l border-t border-[#e5e5e7]"
              />
            ))}
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,#f9f9fa_100%)]"
          />

          <div className="absolute inset-0 grid grid-cols-8 grid-rows-4">
            <div
              data-image-slot="slack"
              aria-label="Image slot for Slack"
              className="col-start-6 row-start-2 flex items-center justify-center"
            >
              <SlackMark />
            </div>
            <div
              data-image-slot="notion"
              aria-label="Image slot for Notion"
              className="col-start-3 row-start-3 flex items-center justify-center"
            >
              <NotionMark />
            </div>
          </div>
        </div>

        <h1 className="mt-6 text-[20px] leading-6 font-medium tracking-[-0.03em] text-[#15161a]">
          It’s empty here
        </h1>
        <p className="mt-1 text-[13px] leading-[22px] font-[450] text-[#999a9e]">
          Add knowledge base now
        </p>
        <UploadDocumentsButton
          label="Add knowledge base"
          icon="plus"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-[9px] bg-[#3f3f44] px-4 text-[13px] leading-4 font-medium text-white shadow-[0_1px_1px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#323237] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3f3f44]/35 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
        />
      </div>
    </div>
  );
}
