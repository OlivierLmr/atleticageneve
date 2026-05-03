const API_BASE = import.meta.env.VITE_API_URL ?? ''

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('session_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: unknown }
    let errorMessage: string
    if (typeof body.error === 'string') {
      errorMessage = body.error || res.statusText || 'Request failed'
    } else if (body.error && typeof body.error === 'object') {
      const issues = (body.error as Record<string, unknown>).issues
      if (Array.isArray(issues) && issues.length > 0) {
        const first = issues[0] as Record<string, unknown>
        errorMessage = typeof first.message === 'string' ? first.message : 'Validation error'
      } else {
        errorMessage = res.statusText || 'Request failed'
      }
    } else {
      errorMessage = res.statusText || 'Request failed'
    }
    throw new ApiError(res.status, errorMessage)
  }

  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export { ApiError }
