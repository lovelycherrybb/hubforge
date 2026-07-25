"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[#333] mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#333]",
            "placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] focus:border-[#1a1a2e]",
            "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
            error && "border-[#e94560] focus:ring-[#e94560] focus:border-[#e94560]",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-[#e94560]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
