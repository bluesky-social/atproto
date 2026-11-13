import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import * as constants from './constants.ts'
import * as lexicons from './lexicons.ts'

console.warn(
  '%cWarning!',
  'font-size: 30px; font-weight: bold; color: red; text-shadow: 1px 1px black;',
)
console.warn(
  '%cThis is a browser feature intended for developers. If someone told you to copy and paste something here to enable a feature or "hack" someone\'s account, it is a scam and will give them access to your account.',
  'font-size: 16px;',
)

console.table({ ...constants })

// Expose lexicons to the global scope for use with the lex clients
Object.assign(window, lexicons)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
