import { app } from '../../lexicons/index.js'
import { ActorDb } from '../db'
import { PrefAllowedOptions, getAgeFromDatestring, prefAllowed } from './util'

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
      app.bsky.actor.defs.personalDetailsPref.$isTypeOf,
    )

    if (personalDetailsPref?.birthDate) {
      const age = getAgeFromDatestring(personalDetailsPref.birthDate)
      prefs.push(
        app.bsky.actor.defs.declaredAgePref.$build({
          isOverAge13: age >= 13,
          isOverAge16: age >= 16,
          isOverAge18: age >= 18,
        }),
      )
    }

    return prefs.filter((pref) => prefAllowed(pref.$type, opts))
  }
}

export type AccountPreference = app.bsky.actor.defs.Preferences[number]

export const prefMatchNamespace = (namespace: string, fullname: string) => {
  return fullname === namespace || fullname.startsWith(`${namespace}.`)
}
