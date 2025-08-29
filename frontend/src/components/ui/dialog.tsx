import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface DialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  isLoading?: boolean;
  loadingContent?: React.ReactNode;
  disableCloseOnOverlayClick?: boolean;
}

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  (
    {
      isOpen,
      setIsOpen,
      children,
      title,
      isLoading = false,
      loadingContent,
      disableCloseOnOverlayClick = false,
    },
    ref
  ) => {
    if (!isOpen) return null;

    const handleOverlayClick = () => {
      if (isLoading || disableCloseOnOverlayClick) return;
      setIsOpen(false);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={handleOverlayClick}
        />
        <div
          ref={ref}
          className="relative bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 p-6"
          aria-busy={isLoading}
        >
          {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
          {children}

          {isLoading && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
              {loadingContent ? (
                loadingContent
              ) : (
                <div className="flex flex-col items-center space-y-3 text-center">
                  <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                  <p className="text-sm text-gray-600">Loading...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);
Dialog.displayName = "Dialog";

export { Dialog };
