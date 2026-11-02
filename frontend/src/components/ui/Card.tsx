import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-warm-white border border-charcoal/[0.06] p-5",
        className
      )}
      {...props}
    />
  );
}
