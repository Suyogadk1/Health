import { cn } from "@/lib/utils/cn";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-charcoal/10 bg-warm-white px-4 py-2.5 text-sm text-charcoal placeholder:text-soft-gray focus:outline-none focus:ring-2 focus:ring-sage",
        className
      )}
      {...props}
    />
  );
}
