"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Info, X, RotateCcw } from "lucide-react";
import { Button } from "./button";
import { TransactionError } from "@/lib/transaction-error-handler";

interface TransactionNotificationProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  error?: TransactionError;
  onRetry?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export function TransactionNotification({
  isVisible,
  onClose,
  title,
  message,
  type,
  error,
  onRetry,
  autoClose = false,
  autoCloseDelay = 5000,
}: TransactionNotificationProps) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isVisible && autoClose && type === "success") {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoClose, autoCloseDelay, type]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-yellow-50 border-yellow-200";
      case "info":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getTextColor = () => {
    switch (type) {
      case "success":
        return "text-green-800";
      case "error":
        return "text-red-800";
      case "warning":
        return "text-yellow-800";
      case "info":
        return "text-blue-800";
      default:
        return "text-gray-800";
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md w-full mx-4 transform transition-all duration-300 ${
        isClosing ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
      }`}
    >
      <div
        className={`rounded-lg border p-4 shadow-lg ${getBackgroundColor()}`}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">{getIcon()}</div>
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-medium ${getTextColor()}`}>{title}</h3>
            <div className={`mt-1 text-sm ${getTextColor()}`}>
              <p>{message}</p>

              {/* Show error details if available */}
              {error && (
                <div className="mt-2 text-xs opacity-75">
                  <p>Error Code: {error.code}</p>
                  {error.isUserCancelled && (
                    <p className="text-blue-600">
                      • Transaction was cancelled by user
                    </p>
                  )}
                  {error.isRetryable && (
                    <p className="text-green-600">
                      • This error can be retried
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex space-x-2">
              {onRetry && error?.isRetryable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClose}
                className="text-xs"
              >
                Dismiss
              </Button>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleClose}
              className={`inline-flex rounded-md p-1.5 ${getTextColor()} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for managing transaction notifications
export function useTransactionNotification() {
  const [notification, setNotification] = useState<{
    isVisible: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
    error?: TransactionError;
    onRetry?: () => void;
  }>({
    isVisible: false,
    title: "",
    message: "",
    type: "info",
  });

  const showNotification = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info" = "info",
    error?: TransactionError,
    onRetry?: () => void
  ) => {
    setNotification({
      isVisible: true,
      title,
      message,
      type,
      error,
      onRetry,
    });
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, isVisible: false }));
  };

  const showSuccess = (title: string, message: string) => {
    showNotification(title, message, "success");
  };

  const showError = (
    title: string,
    message: string,
    error?: TransactionError,
    onRetry?: () => void
  ) => {
    showNotification(title, message, "error", error, onRetry);
  };

  const showWarning = (title: string, message: string) => {
    showNotification(title, message, "warning");
  };

  const showInfo = (title: string, message: string) => {
    showNotification(title, message, "info");
  };

  return {
    notification,
    showNotification,
    hideNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}
