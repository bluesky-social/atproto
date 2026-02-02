import { app } from '../../lexicons/index.js'

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

  return !isFullAccessOnlyPref(prefType)
}

export function isFullAccessOnlyPref(
  type: string,
): type is typeof app.bsky.actor.defs.declaredAgePref.$type {
  return type === app.bsky.actor.defs.declaredAgePref.$type
}

export function isReadOnlyPref(
  type: string,
): type is typeof app.bsky.actor.defs.declaredAgePref.$type {
  return type === app.bsky.actor.defs.declaredAgePref.$type
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
