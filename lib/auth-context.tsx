"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react"
import { apiClient, setAccessToken, getAccessToken, setSessionCookie, ApiError } from "./api-client"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  name: string
  avatar?: string
  isEmailVerified: boolean
  onboardingCompleted: boolean
  workspaceName?: string
  mainUseCase?: string
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  /** True when the user has completed onboarding (workspaceName is set) */
  onboardingComplete: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  logout: () => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  /** Patch profile — used at the end of onboarding */
  updateProfile: (data: Partial<Pick<AuthUser, "workspaceName" | "mainUseCase" | "firstName" | "lastName" | "avatar">>) => Promise<void>
  /** Re-fetch the current user from /api/v1/users/me */
  refreshUser: () => Promise<void>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ApiAuthResponse {
  accessToken: string
  expiresIn: number
  user: {
    _id: string
    email: string
    firstName: string
    lastName: string
    avatar?: string
    isEmailVerified?: boolean
    onboardingCompleted: boolean
    workspaceName?: string
    mainUseCase?: string
  }
}

function mapUser(raw: ApiAuthResponse["user"]): AuthUser {
  return {
    id: raw._id,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
    name: `${raw.firstName} ${raw.lastName}`,
    avatar: raw.avatar,
    isEmailVerified: raw.isEmailVerified ?? false,
    onboardingCompleted: raw.onboardingCompleted ?? false,
    workspaceName: raw.workspaceName,
    mainUseCase: raw.mainUseCase,
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true) // start true — bootstrapping

  // ── Bootstrap: restore session on mount ───────────────────────────────────
  const refreshUser = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    try {
      // apiClient will automatically attempt a refresh if the current token is expired
      const me = await apiClient.get<ApiAuthResponse["user"]>("/api/v1/users/me")
      const mapped = mapUser(me)
      setUser(mapped)
      setSessionCookie(mapped.onboardingCompleted ? 'active' : 'pending')
    } catch (err) {
      // If it still fails, the token is truly invalid or refresh failed
      setAccessToken(null)
      setSessionCookie(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const data = await apiClient.post<ApiAuthResponse>(
        "/api/v1/auth/login",
        { email, password },
        { noAuth: true }
      )
      setAccessToken(data.accessToken)
      const mapped = mapUser(data.user)
      setUser(mapped)
      setSessionCookie(mapped.onboardingCompleted ? 'active' : 'pending')
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (email: string, password: string, firstName: string, lastName: string) => {
    setIsLoading(true)
    try {
      const data = await apiClient.post<ApiAuthResponse>(
        "/api/v1/auth/register",
        { email, password, firstName, lastName },
        { noAuth: true }
      )
      setAccessToken(data.accessToken)
      setUser(mapUser(data.user))
      setSessionCookie('pending') // new users always start onboarding
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await apiClient.post("/api/v1/auth/logout")
    } catch {
      // best-effort
    } finally {
      setAccessToken(null)
      setUser(null)
      setSessionCookie(null)
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
    }
  }

  /**
   * Exchange a Google ID token (JWT credential from Google Identity Services)
   * for a Postly session. Server-side verifies the token and upserts the user.
   */
  const loginWithGoogle = async (credential: string) => {
    if (!credential) throw new Error("Missing Google credential")
    setIsLoading(true)
    try {
      const data = await apiClient.post<ApiAuthResponse>(
        "/api/v1/auth/google",
        { credential },
        { noAuth: true }
      )
      setAccessToken(data.accessToken)
      const mapped = mapUser(data.user)
      setUser(mapped)
      setSessionCookie(mapped.onboardingCompleted ? 'active' : 'pending')
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfile = async (data: Partial<Pick<AuthUser, "workspaceName" | "mainUseCase" | "firstName" | "lastName" | "avatar">>) => {
    const updated = await apiClient.put<ApiAuthResponse["user"]>("/api/v1/users/me", data)
    const mapped = mapUser(updated)
    setUser(mapped)
    setSessionCookie(mapped.onboardingCompleted ? 'active' : 'pending')
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isAuthenticated = user !== null
  const onboardingComplete = user?.onboardingCompleted === true

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        onboardingComplete,
        login,
        signup,
        logout,
        loginWithGoogle,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
