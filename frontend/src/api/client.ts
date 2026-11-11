/**
 * HTTP Client
 * Base fetch wrapper for API communication
 */

import { type APIError } from '../types/api';

/**
 * Base API URL - defaults to localhost:8000
 * Override with VITE_API_URL environment variable
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * HTTP Client Error
 * Thrown when API request fails
 */
export class HTTPError extends Error {
  status: number;
  statusText: string;
  data?: APIError;

  constructor(status: number, statusText: string, data?: APIError) {
    super(`HTTP ${status}: ${statusText}${data?.detail ? ` - ${data.detail}` : ''}`);
    this.name = 'HTTPError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

/**
 * HTTP Request Options
 */
interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

/**
 * Generic HTTP request function
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  // Default headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Make request
  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers,
  });

  // Handle errors
  if (!response.ok) {
    let errorData: APIError | undefined;
    try {
      errorData = await response.json();
    } catch {
      // No JSON error body
    }
    throw new HTTPError(response.status, response.statusText, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // Parse JSON response
  return response.json();
}

/**
 * HTTP Client methods
 */
export const apiClient = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  /**
   * POST request
   */
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  /**
   * PUT request
   */
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
