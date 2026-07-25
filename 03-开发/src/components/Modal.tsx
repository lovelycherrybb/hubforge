"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useId, Children, cloneElement, isValidElement, type ReactNode, type ReactElement } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /**
   * When provided, Modal uses this id for the first <form> in children.
   * Caller should add form={formId} to their submit button in footer
   * so it submits the form even though the button renders outside it.
   * If omitted, a unique id is auto-generated.
   */
  formId?: string;
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({ open, onClose, title, children, footer, size = "md", formId }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const resolvedFormId = formId ?? autoId;

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Inject id into the first <form> child so footer buttons can reference it
  let formInjected = false;
  const enhancedChildren = Children.map(children, (child) => {
    if (!formInjected && isValidElement(child) && (child as ReactElement).type === "form") {
      formInjected = true;
      return cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: resolvedFormId,
      });
    }
    return child;
  });

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="fixed inset-0 bg-black/40" />
      <div
        className={cn(
          "relative z-10 w-full mx-4 bg-white rounded-lg shadow-xl",
          sizeStyles[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-[#333]">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-[#333] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-5 py-4">{enhancedChildren}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
