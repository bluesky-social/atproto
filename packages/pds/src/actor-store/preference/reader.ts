import { ActorDb } from '../db'
import {
  DECLARED_AGE_PREF,
  PERSONAL_DETAILS_PREF,
  PrefAllowedOptions,
  getAgeFromDatestring,
  prefAllowed,
} from './util'

export class PreferenceReader {
  constructor(public db: ActorDb) {}

  async getPreferences(
    namespace: string,
    opts: PrefAllowedOptions,
  ): Promise<AccountPreference[]> {
    const prefsRes = await this.db.db
      .selectFrom('account_pref')
      .orderBy('id')
      .selectAll()
      .execute()

    const prefs = prefsRes
      .filter((pref) => !namespace || prefMatchNamespace(namespace, pref.name))
      .map((pref) => JSON.parse(pref.valueJson) as AccountPreference)
    const personalDetailsPref = prefs.find(
      (pref) => pref.$type === PERSONAL_DETAILS_PREF,
    )

    if (personalDetailsPref) {
      if (typeof personalDetailsPref.birthDate === 'string') {
        const age = getAgeFromDatestring(personalDetailsPref.birthDate)
        const declaredAgePref: AccountPreference = {
          $type: DECLARED_AGE_PREF,
          isOverAge13: age >= 13,
          isOverAge16: age >= 16,
          isOverAge18: age >= 18,
        }
        prefs.push(declaredAgePref)
      }
    }

    return prefs.filter((pref) => prefAllowed(pref.$type, opts))
  }
}

export type AccountPreference = Record<string, unknown> & { $type: string }

export const prefMatchNamespace = (namespace: string, fullname: string) => {
  return fullname === namespace || fullname.startsWith(`${namespace}.`)
}
