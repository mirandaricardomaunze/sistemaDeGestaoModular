/**
 * Result Pattern Utility
 * Standardizes backend service responses for professional consistency.
 */

export interface Result<T = any> {
  success: boolean;
  data: T | null;
  error?: string;
  message?: string;
  timestamp: string;
}

export class ResultHandler {
  /**
   * Returns a successful result object.
   */
  static success<T>(data: T, message?: string): Result<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns a failed result object.
   */
  static failure(error: string, message?: string): Result<null> {
    return {
      success: false,
      data: null,
      error,
      message,
      timestamp: new Date().toISOString(),
    };
  }
}
