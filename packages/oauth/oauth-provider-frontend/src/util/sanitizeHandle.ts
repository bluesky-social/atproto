export function isInvalidHandle(handle: string): boolean {
  return handle === 'handle.invalid'
}

export function sanitizeHandle(handle?: string): string | undefined {
  if (!handle) return undefined
  return isInvalidHandle(handle)
    ? '⚠Invalid Handle'
    : `@${handle.replace(/^@/, '')}`
}
