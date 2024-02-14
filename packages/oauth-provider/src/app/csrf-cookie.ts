import { backendData } from './backend-data'

const parseCookieString = (cookie: string) =>
  Object.fromEntries(
    cookie
      .split(';')
      .filter(Boolean)
      .map((str) => str.split('=', 2).map((s) => decodeURIComponent(s.trim()))),
  )

export const csrfToken = parseCookieString(document.cookie)[
  backendData.csrfCookie
]
