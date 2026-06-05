import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { useAuthStore } from './store/auth.store'

const params = new URLSearchParams(window.location.search)
const urlToken = params.get('token')
if (urlToken) {
  // Evita dejar el token visible en la barra de direcciones tras el intercambio OAuth
  useAuthStore.getState().setToken(urlToken)
  window.history.replaceState({}, '', window.location.pathname)
} else {
  useAuthStore.getState().hydrate()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
