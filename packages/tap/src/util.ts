export const formatAdminAuthHeader = (password: string) => {
  return 'Basic ' + Buffer.from(`admin:${password}`).toString('base64')
}

export const parseAdminAuthHeader = (header: string) => {
  const noPrefix = header.startsWith('Basic ') ? header.slice(6) : header
  const [username, password] = Buffer.from(noPrefix, 'base64')
    .toString()
    .split(':')
  if (username !== 'admin') {
    throw new Error("Unexpected username in admin headers. Expected 'admin'")
  }
  return password
}

export const assureAdminAuth = (expectedPassword: string, header: string) => {
  const headerPassword = parseAdminAuthHeader(header)
  const passEqual = timingSafeEqual(headerPassword, expectedPassword)
  if (!passEqual) {
    throw new Error('Invalid admin password')
  }
}

const timingSafeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // Compare against self to maintain constant time even with length mismatch
    Buffer.from(a).compare(Buffer.from(a))
    return false
  }
  return bufA.compare(bufB) === 0
}

export function isCausedBySignal(err: unknown, signal: AbortSignal) {
  if (!signal.aborted) return false
  if (signal.reason == null) return false // Ignore nullish reasons
  return (
    err === signal.reason ||
    (err instanceof Error && err.cause === signal.reason)
  )
}
