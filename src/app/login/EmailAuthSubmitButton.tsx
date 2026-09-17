"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

const DEFAULT_SUBMIT_CLASS =
  "w-full flex h-10 items-center justify-center gap-2 rounded-lg bg-black text-white text-[13px] font-semibold shadow-sm transition-all duration-200 hover:bg-gray-800 active:scale-[0.98] disabled:cursor-wait disabled:bg-gray-800 disabled:opacity-90";

interface EmailAuthSubmitButtonProps {
  action?: (formData: FormData) => void | Promise<void>;
  idleLabel: string;
  pendingLabel: string;
  /** Lets other auth screens keep their own look while sharing the pending behaviour. */
  className?: string;
}

export function EmailAuthSubmitButton({
  action,
  idleLabel,
  pendingLabel,
  className = DEFAULT_SUBMIT_CLASS,
}: EmailAuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={action}
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      <span>{pending ? pendingLabel : idleLabel}</span>
    </button>
  );
}
