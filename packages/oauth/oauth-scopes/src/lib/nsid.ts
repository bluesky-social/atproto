export type NSID = `${string}.${string}`
export const isNSID = (value: string): value is NSID =>
  value.includes('.') &&
  !value.includes(' ') &&
  !value.startsWith('.') &&
  !value.endsWith('.')
