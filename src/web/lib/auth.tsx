import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api, ApiError } from './api'
import type { UserRole } from '@shared/types'

interface AuthUser {
  id: string
  role: UserRole
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  organization: string | null
  preferredLang: 'en' | 'fr'
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  requestMagicLink: (email: string) => Promise<void>
  verifyMagicLink: (token: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('session_token')
    if (!token) {
      setIsLoading(false)
      return
    }

    api.get<AuthUser>('/api/v1/auth/me')
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('session_token')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/v1/auth/login', {
      username,
      password,
    })
    localStorage.setItem('session_token', res.token)
    setUser(res.user)
  }, [])

  const requestMagicLink = useCallback(async (email: string) => {
    await api.post('/api/v1/auth/magic-link', { email })
  }, [])

  const verifyMagicLink = useCallback(async (token: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/v1/auth/verify-magic-link', {
      token,
    })
    localStorage.setItem('session_token', res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout')
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem('session_token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, requestMagicLink, verifyMagicLink, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
