export const PERSONAL_DETAILS_PREF = 'app.bsky.actor.defs#personalDetailsPref'
export const DECLARED_AGE_PREF = 'app.bsky.actor.defs#declaredAgePref'

const FULL_ACCESS_ONLY_PREFS = new Set([PERSONAL_DETAILS_PREF])

export type PrefAllowedOptions = {
  hasAccessFull?: boolean
}

export function prefAllowed(
  prefType: string,
  options?: PrefAllowedOptions,
): boolean {
  if (options?.hasAccessFull === true) {
    return true
  }

  return !FULL_ACCESS_ONLY_PREFS.has(prefType)
}

const READ_ONLY_PREFS = new Set([DECLARED_AGE_PREF])

export function isReadOnlyPref(prefType: string) {
  return READ_ONLY_PREFS.has(prefType)
}

export function getAgeFromDatestring(birthDate: string): number {
  const bday = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - bday.getFullYear()
  const m = today.getMonth() - bday.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) {
    age--
  }
  return age
}
