import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The two typefaces of the interface travel with the app: no request to a font service
import '@fontsource-variable/inter'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
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
