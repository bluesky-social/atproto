export const MIN_PASSWORD_LENGTH = 8

const EMOJI =
  /(\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/
const UPPER = /[A-Z]/
const LOWER = /[a-z]/
const DEC = /[0-9]/
const SPECIAL = /[^a-zA-Z0-9]/

export enum PasswordStrength {
  weak = 1,
  moderate = 2,
  strong = 3,
  extra = 4,
}

export function getPasswordStrength(pwd: string): PasswordStrength {
  if (pwd.length < MIN_PASSWORD_LENGTH) {
    return PasswordStrength.weak
  }

  // Very long passwords
  if (pwd.length >= MIN_PASSWORD_LENGTH + 12) {
    return PasswordStrength.extra
  }

  // Long passwords
  if (pwd.length >= MIN_PASSWORD_LENGTH + 8) {
    if (matches(pwd, [SPECIAL])) {
      return PasswordStrength.extra
    }
    if (matches(pwd, [UPPER, LOWER, DEC], 2)) {
      return PasswordStrength.extra
    }
    return PasswordStrength.strong
  }

  // Emojis make passwords strong
  if (pwd.length >= MIN_PASSWORD_LENGTH) {
    if (matches(pwd, [EMOJI])) {
      return PasswordStrength.strong
    }
  }

  // Pretty long passwords
  if (pwd.length >= MIN_PASSWORD_LENGTH + 6) {
    if (matches(pwd, [SPECIAL])) {
      return PasswordStrength.strong
    }
    if (matches(pwd, [UPPER, LOWER, DEC], 2)) {
      return PasswordStrength.strong
    }
    // Only 1 type of alpha-num characters
    return PasswordStrength.moderate
  }

  // Longish password
  if (pwd.length >= MIN_PASSWORD_LENGTH + 4) {
    if (matches(pwd, [SPECIAL])) {
      return PasswordStrength.moderate
    }
    if (matches(pwd, [UPPER, LOWER, DEC], 2)) {
      return PasswordStrength.moderate
    }

    // Only 1 type of alpha-num characters
    return PasswordStrength.weak
  }

  // Short password (8-11 characters)
  if (pwd.length >= MIN_PASSWORD_LENGTH) {
    if (matches(pwd, [SPECIAL])) {
      return PasswordStrength.moderate
    }
    if (matches(pwd, [UPPER, LOWER, DEC])) {
      return PasswordStrength.moderate
    }
  }

  return PasswordStrength.weak
}

function matches(
  pwd: string,
  regexps: RegExp[],
  regexpsCountToMatch: number = regexps.length,
): boolean {
  if (regexpsCountToMatch < 1 || regexpsCountToMatch > regexps.length) {
    throw new TypeError('Invalid regexpsCountToMatch')
  }
  for (const regexp of regexps) {
    if (regexp.test(pwd)) {
      regexpsCountToMatch--
      if (regexpsCountToMatch === 0) return true
    }
  }
  return false
}
