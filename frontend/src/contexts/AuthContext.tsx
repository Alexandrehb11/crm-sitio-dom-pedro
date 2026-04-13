import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '@/lib/api'
import type { UserOut } from '@/types'

interface AuthContextValue {
  user: UserOut | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('crm_token')
  }, [])

  useEffect(() => {
    const storedToken = localStorage.getItem('crm_token')
    if (storedToken) {
      setToken(storedToken)
      authApi
        .me()
        .then((u) => {
          setUser(u)
        })
        .catch(() => {
          localStorage.removeItem('crm_token')
          setToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }

    const handleAuthLogout = () => logout()
    window.addEventListener('auth:logout', handleAuthLogout)
    return () => window.removeEventListener('auth:logout', handleAuthLogout)
  }, [logout])

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password)
    localStorage.setItem('crm_token', response.access_token)
    setToken(response.access_token)
    setUser(response.user)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
