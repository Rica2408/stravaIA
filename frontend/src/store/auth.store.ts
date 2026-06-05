import { create } from 'zustand'

interface AuthState {
  token: string | null
  hydrated: boolean
  isAdmin: boolean
  setToken: (token: string | null) => void
  setIsAdmin: (isAdmin: boolean) => void
  hydrate: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  hydrated: false,
  isAdmin: false,
  setToken: (token) => {
    if (token) {
      localStorage.setItem('jwt', token)
    } else {
      localStorage.removeItem('jwt')
    }
    set({ token, hydrated: true, isAdmin: false })
  },
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  hydrate: () => {
    const token = localStorage.getItem('jwt')
    set({ token, hydrated: true })
  },
  logout: () => {
    localStorage.removeItem('jwt')
    set({ token: null, isAdmin: false })
  },
}))
