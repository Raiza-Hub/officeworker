"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { z } from "zod";

const DEFAULT_PORTAL_URL = "https://diper.ogunstate.gov.ng";

const workspaceSchema = z.object({
  portalUrl: z.union([z.literal(""), z.string().url("Enter a valid portal URL")]),
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type WorkspaceFields = z.infer<typeof workspaceSchema>;

const fieldClassName =
  "h-[44px] w-[400px] max-w-full rounded-[12px] border border-[#dedfe3] bg-white px-4 text-[13px] leading-normal font-normal tracking-normal text-[#202126] outline-none transition-[border-color,box-shadow] placeholder:text-[#a0a3aa] hover:border-[#c7c9cf] focus:border-[#7279dc] focus:ring-4 focus:ring-[#7279dc]/10 disabled:cursor-not-allowed disabled:border-[#e5e6e9] disabled:bg-[#f7f7f8] disabled:text-[#81848c] disabled:opacity-100 motion-reduce:transition-none";

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-[18px] w-[18px]"
    >
      {visible ? (
        <>
          <path
            d="M2.4 10s2.7-4.2 7.6-4.2 7.6 4.2 7.6 4.2-2.7 4.2-7.6 4.2S2.4 10 2.4 10Z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="10" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.4" />
        </>
      ) : (
        <>
          <path
            d="M2.4 10s2.7-4.2 7.6-4.2 7.6 4.2 7.6 4.2-2.7 4.2-7.6 4.2S2.4 10 2.4 10Z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="10" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.4" />
          <path d="m4 16 12-12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function WorkspaceForm() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const upsertConnection = useAction(api.workspaceActions.upsertConnection);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceFields>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      portalUrl: DEFAULT_PORTAL_URL,
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await upsertConnection({
        portalKey: "diper",
        portalUrl: values.portalUrl || DEFAULT_PORTAL_URL,
        portalEmail: values.email,
        password: values.password,
      });
      toast.success("Workspace connected", {
        description: "Your portal account is linked to this workspace.",
      });
      router.replace("/dashboard");
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Could not link the portal account. Try again.",
      );
    }
  });

  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-app-bg px-5 py-16 text-[#202126] sm:px-8">
      <section aria-labelledby="workspace-title" className="w-full max-w-[520px]">
        <header className="mb-10 text-center">
          <h1
            id="workspace-title"
            className="m-0 text-[20px] leading-[1.2] font-medium tracking-[-0.04em] text-[#202126]"
          >
            Create a workspace
          </h1>
          <p className="mb-0 mt-3 text-[15px] leading-[23px] font-[450] text-[#777b83]">
            Move work forward across teams and agents
          </p>
        </header>

        <form className="mx-auto w-[400px] max-w-full space-y-6" noValidate onSubmit={onSubmit}>
          <div>
            <label
              htmlFor="portalUrl"
              className="mb-3 block h-[15.5px] w-[400px] max-w-full rounded-none text-[13px] leading-normal font-medium tracking-normal text-[#686b72]"
            >
              URL
            </label>
            <input
              {...register("portalUrl")}
              id="portalUrl"
              type="url"
              placeholder="https://diper.ogunstate.gov.ng"
              disabled
              className={fieldClassName}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-3 block h-[15.5px] w-[400px] max-w-full rounded-none text-[13px] leading-normal font-medium tracking-normal text-[#686b72]"
            >
              Email
            </label>
            <input
              {...register("email")}
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={fieldClassName}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="mb-0 mt-2 text-[13px] text-[#b42318]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-3 block h-[15.5px] w-[400px] max-w-full rounded-none text-[13px] leading-normal font-medium tracking-normal text-[#686b72]"
            >
              Password
            </label>
            <div className="relative">
              <input
                {...register("password")}
                id="password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={`${fieldClassName} pr-14`}
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                aria-pressed={passwordVisible}
                className="absolute top-1/2 right-2.5 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-transparent text-[#858990] transition-colors hover:text-[#45474e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7279dc] motion-reduce:transition-none"
              >
                <EyeIcon visible={passwordVisible} />
              </button>
            </div>
            {errors.password && (
              <p id="password-error" role="alert" className="mb-0 mt-2 text-[13px] text-[#b42318]">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 inline-flex h-[44px] w-full items-center justify-center rounded-full bg-[#202126] px-5 text-[13px] leading-normal font-medium tracking-normal text-white transition-[background-color,transform] duration-150 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#202126] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 active:scale-[0.99] motion-reduce:transition-none"
          >
            Create workspace
          </button>

          {serverError && (
            <p role="alert" className="m-0 text-center text-[13px] text-[#b42318]">
              {serverError}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
