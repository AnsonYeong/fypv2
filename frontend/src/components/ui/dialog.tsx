import * as React from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
}

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  ({ isOpen, setIsOpen, children, title }, ref) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
        <div
          ref={ref}
          className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6"
        >
          {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
          {children}
        </div>
      </div>
    );
  }
);
Dialog.displayName = "Dialog";

export { Dialog };
