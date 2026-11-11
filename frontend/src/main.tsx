import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerBundledIcons } from './utils/bundledIcons'

// The app's own icons are shipped with it: no request to the icon API
registerBundledIcons()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
