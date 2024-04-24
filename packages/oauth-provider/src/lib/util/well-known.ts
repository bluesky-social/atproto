export function buildWellknownUrl(url: URL, name: string): URL {
  const path =
    url.pathname === '/'
      ? `/.well-known/${name}`
      : `${url.pathname.replace(/\/+$/, '')}/${name}`

  return new URL(path, url)
}
