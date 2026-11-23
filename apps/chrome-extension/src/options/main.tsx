import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfirmHost } from '../shared/confirm'
import '../ui/theme.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ConfirmHost />
  </StrictMode>,
)
