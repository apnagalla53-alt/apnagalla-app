/**
 * EVOLIX Trade ERP — API Client.
 *
 * Centralized API access. No hardcoded base URLs.
 * Reads configuration from environment.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  status: number;
  correlationId: string | null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const correlationId = response.headers.get('X-Correlation-ID');

    if (response.ok) {
      const data = (await response.json()) as T;
      return { data, error: null, status: response.status, correlationId };
    }

    const error = (await response.json()) as ApiError;
    return { data: null, error, status: response.status, correlationId };
  } catch {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your network connection.',
        details: {},
      },
      status: 0,
      correlationId: null,
    };
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};

export type { ApiError, ApiResponse };
