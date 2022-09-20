export const isRecord = (obj: unknown): obj is Record<string, unknown> => {
  return !!obj && typeof obj === 'object'
}
