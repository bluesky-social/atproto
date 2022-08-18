export const isRecord = (obj: unknown): obj is Record<string, unknown> => {
  return true
  // return !!obj && typeof obj === 'object'
}
