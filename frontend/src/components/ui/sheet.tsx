import * as React from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
}

const Sheet = React.forwardRef<HTMLDivElement, SheetProps>(
  ({ isOpen, setIsOpen, children, title }, ref) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
        <div
          ref={ref}
          className="relative ml-auto flex h-full w-full max-w-sm flex-col bg-white shadow-xl"
        >
          <div className="flex items-center justify-between p-4 border-b">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-2 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">{children}</div>
        </div>
      </div>
    );
  }
);
Sheet.displayName = "Sheet";

const X = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("h-4 w-4", className)}
    {...props}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export { Sheet };
