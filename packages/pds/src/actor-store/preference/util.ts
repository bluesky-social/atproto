const FULL_ACCESS_ONLY_PREFS = new Set([
  'app.bsky.actor.defs#personalDetailsPref',
])

export type PrefAllowedOptions = {
  fullAccess?: boolean
}

export function prefAllowed(
  prefType: string,
  options?: PrefAllowedOptions,
): boolean {
  if (FULL_ACCESS_ONLY_PREFS.has(prefType)) {
    return options?.fullAccess === true
  }

  return true
}
