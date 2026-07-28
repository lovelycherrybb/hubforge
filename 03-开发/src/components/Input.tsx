"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const effectiveType = isPassword && showPassword ? "text" : type;

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
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={effectiveType}
            className={cn(
              "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#333]",
              "placeholder:text-gray-400",
              "focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] focus:border-[#1a1a2e]",
              "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
              error && "border-[#e94560] focus:ring-[#e94560] focus:border-[#e94560]",
              isPassword && "pr-10",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-[#555] transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
            >
              {showPassword ? (
                // eye-off icon
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                // eye icon
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-[#e94560]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
