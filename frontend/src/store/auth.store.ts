import { create } from 'zustand'

interface AuthState {
  token: string | null
  hydrated: boolean
  setToken: (token: string | null) => void
  hydrate: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  hydrated: false,
  setToken: (token) => {
    if (token) {
      localStorage.setItem('jwt', token)
    } else {
      localStorage.removeItem('jwt')
    }
    set({ token, hydrated: true })
  },
  hydrate: () => {
    const token = localStorage.getItem('jwt')
    set({ token, hydrated: true })
  },
  logout: () => {
    localStorage.removeItem('jwt')
    set({ token: null })
  },
}))
