export class ApiError extends Error {
  readonly status: number;
  readonly details?: string[];

  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface ApiErrorBody {
  message?: string | string[];
}

/**
 * The Next rewrite keeps this relative URL on the application's origin.
 * It is intentionally the only fetch gateway used by the auth layer.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...requestOptions } = options;
  const response = await fetch(`/api/v1${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: {
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // The status is still useful when a reverse proxy returns no JSON.
    }
    const details = Array.isArray(body?.message) ? body.message : undefined;
    const message =
      (typeof body?.message === 'string' ? body.message : undefined) ??
      details?.[0] ??
      (response.status >= 500
        ? 'The service is temporarily unavailable. Please try again.'
        : 'Something went wrong. Please try again.');
    throw new ApiError(message, response.status, details);
  }

  return (await response.json()) as T;
}
