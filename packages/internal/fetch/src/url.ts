export const extractUrl = (input: Request | string | URL) =>
  typeof input === 'string'
    ? new URL(input)
    : input instanceof URL
      ? input
      : new URL(input.url)
