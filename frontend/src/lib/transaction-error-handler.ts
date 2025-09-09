// Transaction error handling utilities
export interface TransactionError {
  code: string;
  message: string;
  userFriendlyMessage: string;
  isUserCancelled: boolean;
  isRetryable: boolean;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: TransactionError;
  fileShouldAppearInDashboard: boolean;
}

// Common transaction error codes and their meanings
const ERROR_MAPPINGS: Record<
  string,
  { userFriendlyMessage: string; isRetryable: boolean }
> = {
  // User rejection errors
  ACTION_REJECTED: {
    userFriendlyMessage: "Transaction was cancelled by user",
    isRetryable: true,
  },
  USER_REJECTED: {
    userFriendlyMessage: "Transaction was cancelled by user",
    isRetryable: true,
  },
  "4001": {
    userFriendlyMessage: "Transaction was cancelled by user",
    isRetryable: true,
  },

  // Insufficient funds
  INSUFFICIENT_FUNDS: {
    userFriendlyMessage: "Insufficient funds to complete transaction",
    isRetryable: true,
  },
  INSUFFICIENT_BALANCE: {
    userFriendlyMessage: "Insufficient balance for gas fees",
    isRetryable: true,
  },

  // Gas related errors
  GAS_LIMIT_EXCEEDED: {
    userFriendlyMessage: "Transaction gas limit exceeded",
    isRetryable: true,
  },
  GAS_PRICE_TOO_LOW: {
    userFriendlyMessage: "Gas price too low for current network conditions",
    isRetryable: true,
  },

  // Network errors
  NETWORK_ERROR: {
    userFriendlyMessage: "Network error occurred. Please check your connection",
    isRetryable: true,
  },
  TIMEOUT: {
    userFriendlyMessage: "Transaction timed out. Please try again",
    isRetryable: true,
  },

  // Contract errors
  EXECUTION_REVERTED: {
    userFriendlyMessage: "Transaction failed due to contract logic",
    isRetryable: false,
  },
  CALL_EXCEPTION: {
    userFriendlyMessage: "Contract call failed",
    isRetryable: false,
  },

  // Viem specific errors
  CONTRACT_EXECUTION_ERROR: {
    userFriendlyMessage: "Contract execution failed",
    isRetryable: false,
  },
  BASE_ERROR: {
    userFriendlyMessage: "Transaction failed",
    isRetryable: true,
  },

  // Generic errors
  UNKNOWN_ERROR: {
    userFriendlyMessage: "An unknown error occurred",
    isRetryable: true,
  },
};

export function parseTransactionError(error: any): TransactionError {
  // Extract error code and message
  let code = "UNKNOWN_ERROR";
  let message = "Unknown error occurred";

  // Handle viem ContractFunctionExecutionError
  if (error?.name === "ContractFunctionExecutionError") {
    if (
      error?.details?.includes("User denied transaction signature") ||
      error?.shortMessage?.includes("User rejected")
    ) {
      code = "USER_REJECTED";
      message = error?.shortMessage || "User rejected the request";
    } else {
      code = "CONTRACT_EXECUTION_ERROR";
      message =
        error?.details ||
        error?.shortMessage ||
        error?.message ||
        "Contract execution failed";
    }
  }
  // Handle viem BaseError
  else if (error?.name === "BaseError") {
    if (error?.shortMessage?.includes("User rejected")) {
      code = "USER_REJECTED";
      message = error.shortMessage;
    } else if (error?.shortMessage?.includes("User denied")) {
      code = "USER_REJECTED";
      message = error.shortMessage;
    } else {
      code = "BASE_ERROR";
      message = error?.shortMessage || error?.message || "Base error occurred";
    }
  }
  // Handle standard error codes
  else if (error?.code) {
    code = error.code.toString();
  } else if (error?.error?.code) {
    code = error.error.code.toString();
  } else if (error?.message) {
    // Try to extract code from message
    const codeMatch = error.message.match(/\(([A-Z_0-9]+)\)/);
    if (codeMatch) {
      code = codeMatch[1];
    }
  }

  if (error?.message && !message.includes("User")) {
    message = error.message;
  } else if (error?.error?.message && !message.includes("User")) {
    message = error.error.message;
  }

  // Check if it's a user cancellation
  const isUserCancelled =
    code === "ACTION_REJECTED" ||
    code === "USER_REJECTED" ||
    code === "4001" ||
    message.toLowerCase().includes("user rejected") ||
    message.toLowerCase().includes("user denied") ||
    message.toLowerCase().includes("cancelled") ||
    message.toLowerCase().includes("rejected") ||
    (error?.name === "ContractFunctionExecutionError" &&
      (error?.details?.includes("User denied") ||
        error?.details?.includes("User rejected")));

  // Get error mapping
  const mapping = ERROR_MAPPINGS[code] || ERROR_MAPPINGS["UNKNOWN_ERROR"];

  const result = {
    code,
    message,
    userFriendlyMessage: mapping.userFriendlyMessage,
    isUserCancelled,
    isRetryable: mapping.isRetryable,
  };

  return result;
}

export function handleTransactionError(
  error: any,
  context: string = "transaction"
): TransactionResult {
  const transactionError = parseTransactionError(error);

  console.error(`❌ ${context} failed:`, {
    code: transactionError.code,
    message: transactionError.message,
    userFriendlyMessage: transactionError.userFriendlyMessage,
    isUserCancelled: transactionError.isUserCancelled,
    isRetryable: transactionError.isRetryable,
  });

  return {
    success: false,
    error: transactionError,
    fileShouldAppearInDashboard: !transactionError.isUserCancelled,
  };
}

export function createTransactionErrorNotification(error: TransactionError): {
  title: string;
  message: string;
  type: "error" | "warning" | "info";
  actions?: Array<{ label: string; action: () => void }>;
} {
  const baseNotification = {
    title: "Transaction Failed",
    message: error.userFriendlyMessage,
    type: "error" as const,
  };

  if (error.isUserCancelled) {
    return {
      ...baseNotification,
      title: "Transaction Cancelled",
      message: "The transaction was cancelled. No changes were made.",
      type: "info",
    };
  }

  if (error.isRetryable) {
    return {
      ...baseNotification,
      message: `${error.userFriendlyMessage} You can try again.`,
      actions: [
        {
          label: "Retry",
          action: () => {
            // This will be handled by the calling component
            console.log("Retry transaction requested");
          },
        },
      ],
    };
  }

  return baseNotification;
}

// Utility to check if a file should appear in dashboard after transaction failure
export function shouldFileAppearInDashboard(
  error: TransactionError,
  operation: "upload" | "share" | "update"
): boolean {
  // For uploads, if it's not user cancelled, the file might have been uploaded to IPFS
  if (operation === "upload") {
    return !error.isUserCancelled;
  }

  // For sharing, if it's not user cancelled, the file should still appear
  if (operation === "share") {
    return !error.isUserCancelled;
  }

  // For updates, if it's not user cancelled, the file should appear with old version
  if (operation === "update") {
    return !error.isUserCancelled;
  }

  return false;
}

// Enhanced error logging for debugging
export function logTransactionError(
  error: any,
  context: string,
  additionalInfo?: any
) {
  console.group(`🚨 Transaction Error: ${context}`);
  console.error("Raw error:", error);
  console.error("Error type:", typeof error);
  console.error("Error constructor:", error?.constructor?.name);
  console.error("Error name:", error?.name);

  if (error?.code) console.error("Error code:", error.code);
  if (error?.message) console.error("Error message:", error.message);
  if (error?.shortMessage)
    console.error("Error shortMessage:", error.shortMessage);
  if (error?.details) console.error("Error details:", error.details);
  if (error?.error) console.error("Nested error:", error.error);
  if (error?.reason) console.error("Error reason:", error.reason);
  if (error?.data) console.error("Error data:", error.data);

  if (additionalInfo) {
    console.error("Additional info:", additionalInfo);
  }

  console.groupEnd();
}
