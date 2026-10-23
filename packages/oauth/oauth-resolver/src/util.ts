export function contentMime(headers: Headers): string | undefined {
  return headers.get('content-type')?.split(';')[0]!.trim()
}
