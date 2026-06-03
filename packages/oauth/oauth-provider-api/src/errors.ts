export const HANDLE_UNAVAILABLE_REASON = Object.freeze([
  'syntax',
  'domain',
  'slur',
  'taken',
  'reserved',
  'resolution',
  'unsupported',
] as const)

export type HandleUnavailableReason = (typeof HANDLE_UNAVAILABLE_REASON)[number]

export const isHandleUnavailableReason = (
  value: unknown,
): value is HandleUnavailableReason => {
  return (HANDLE_UNAVAILABLE_REASON as readonly unknown[]).includes(value)
}

// @TODO consider moving JsonErrorResponse & sub-classes here (or only the
// schemas?), allowing the same code to be used on both the server and client
// for error handling/parsing/formatting.
