type ApiErrorPayload = {
    message?: string;
    error?: string | { message?: string };
    errors?: unknown[];
};

type ApiErrorLike = Error & {
    response?: {
        status?: number;
        data?: ApiErrorPayload;
    };
};

export function getApiErrorStatus(error: unknown): number | undefined {
    return (error as ApiErrorLike)?.response?.status;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as ApiErrorLike;
    const payload = apiError.response?.data;
    const nestedError = payload?.error;

    if (typeof nestedError === 'string') return nestedError;
    return nestedError?.message || payload?.message || apiError.message || fallback;
}
