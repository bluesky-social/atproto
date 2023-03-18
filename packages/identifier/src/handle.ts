import { reservedSubdomains } from './reserved'

export * from './resolve'

// Handle constraints, in English:
//  - must be a possible domain name
//    - RFC-1035 is commonly referenced, but has been updated. eg, RFC-3696,
//      section 2. and RFC-3986, section 3. can now have leading numbers (eg,
//      4chan.org)
//    - "labels" (sub-names) are made of ASCII letters, digits, hyphens
//    - can not start or end with a hyphen
//    - TLD (last component) should not start with a digit
//    - can't end with a hyphen (can end with digit)
//    - each segment must be between 1 and 63 characters (not including any periods)
//    - overall length can't be more than 253 characters
//    - separated by (ASCII) periods; does not start or end with period
//    - case insensitive
//    - domains (handles) are equal if they are the same lower-case
//    - punycode allowed for internationalization
//  - no whitespace, null bytes, joining chars, etc
//  - does not validate whether domain or TLD exists, or is a reserved or
//    special TLD (eg, .onion or .local)
//  - does not validate punycode
export const ensureValidHandle = (handle: string): void => {
  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9.-]*$/.test(handle)) {
    throw new InvalidHandleError(
      'Disallowed characters in handle (ASCII letters, digits, dashes, periods only)',
    )
  }

  if (handle.length > 253) {
    throw new InvalidHandleError('Handle is too long (253 chars max)')
  }
  const labels = handle.split('.')
  if (labels.length < 2) {
    throw new InvalidHandleError('Handle domain needs at least two parts')
  }
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i]
    if (l.length < 1) {
      throw new InvalidHandleError('Handle parts can not be empty')
    }
    if (l.length > 63) {
      throw new InvalidHandleError('Handle part too long (max 63 chars)')
    }
    if (l.endsWith('-') || l.startsWith('-')) {
      throw new InvalidHandleError(
        'Handle parts can not start or end with hyphens',
      )
    }
    if (i + 1 == labels.length && !/^[a-zA-Z]/.test(l)) {
      throw new InvalidHandleError(
        'Handle final component (TLD) must start with ASCII letter',
      )
    }
  }
}

// simple regex translation of above constraints
export const ensureValidHandleRegex = (handle: string): void => {
  if (
    !/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(
      handle,
    )
  ) {
    throw new InvalidHandleError("Handle didn't validate via regex")
  }
  if (handle.length > 253) {
    throw new InvalidHandleError('Handle is too long (253 chars max)')
  }
}

export const normalizeHandle = (handle: string): string => {
  return handle.toLowerCase()
}

export const normalizeAndEnsureValidHandle = (handle: string): string => {
  const normalized = normalizeHandle(handle)
  ensureValidHandle(normalized)
  return normalized
}

export const isValidHandle = (handle: string): boolean => {
  try {
    ensureValidHandle(handle)
  } catch (err) {
    if (err instanceof InvalidHandleError) {
      return false
    }
    throw err
  }
  return true
}

export const ensureHandleServiceConstraints = (
  handle: string,
  availableUserDomains: string[],
  reserved = reservedSubdomains,
): void => {
  const supportedDomain = availableUserDomains.find((domain) =>
    handle.endsWith(domain),
  )
  if (!supportedDomain) {
    throw new UnsupportedDomainError('Not a supported handle domain')
  }
  const front = handle.slice(0, handle.length - supportedDomain.length)
  if (front.indexOf('.') > -1) {
    throw new InvalidHandleError('Invalid characters in handle')
  }
  if (front.length < 3) {
    throw new InvalidHandleError('Handle too short')
  }
  if (handle.length > 30) {
    throw new InvalidHandleError('Handle too long')
  }
  if (reserved[front]) {
    throw new ReservedHandleError('Reserved handle')
  }
}

export const fulfillsHandleServiceConstraints = (
  handle: string,
  availableUserDomains: string[],
  reserved = reservedSubdomains,
): boolean => {
  try {
    ensureHandleServiceConstraints(handle, availableUserDomains, reserved)
  } catch (err) {
    if (
      err instanceof InvalidHandleError ||
      err instanceof ReservedHandleError ||
      err instanceof UnsupportedDomainError
    ) {
      return false
    }
    throw err
  }
  return true
}

export class InvalidHandleError extends Error {}
export class ReservedHandleError extends Error {}
export class UnsupportedDomainError extends Error {}
