export const ifString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined
