export const parseCookieString = (
  cookie: string,
): Record<string, string | undefined> =>
  Object.fromEntries(
    cookie
      .split(';')
      .filter(Boolean)
      .map((str) => str.split('=', 2).map((s) => decodeURIComponent(s.trim()))),
  )

export const cookies = parseCookieString(document.cookie)
