import { AuthScope } from '../../auth-verifier'

const FULL_ACCESS_ONLY_PREFS = ['app.bsky.actor.defs#personalDetailsPref']

export const prefInScope = (scope: AuthScope, prefType: string) => {
  if (scope === AuthScope.Access) return true
  return !FULL_ACCESS_ONLY_PREFS.includes(prefType)
}
