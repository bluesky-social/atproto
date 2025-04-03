export const parseCookieString = (
  cookie: string = document.cookie,
): Record<string, string | undefined> =>
  Object.fromEntries(
    cookie
      .split(';')
      .filter(Boolean)
      .map((str) => str.split('=', 2).map((s) => decodeURIComponent(s.trim()))),
  )

export function readCookie(
  name: string,
  cookie: string = document.cookie,
): string | undefined {
  const cookies = parseCookieString(cookie)
  return cookies[name]
}
