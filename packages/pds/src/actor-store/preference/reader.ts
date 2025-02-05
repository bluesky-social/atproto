import { AuthScope } from '../../auth-verifier'
import { ActorDb } from '../db'
import { prefInScope } from './util'

export class PreferenceReader {
  constructor(public db: ActorDb) {}

  async getPreferences(
    namespace: string,
    scope: AuthScope,
  ): Promise<AccountPreference[]> {
    const prefsRes = await this.db.db
      .selectFrom('account_pref')
      .orderBy('id')
      .selectAll()
      .execute()
    return prefsRes
      .filter((pref) => !namespace || prefMatchNamespace(namespace, pref.name))
      .filter((pref) => prefInScope(scope, pref.name))
      .map((pref) => JSON.parse(pref.valueJson) as AccountPreference)
  }
}

export type AccountPreference = Record<string, unknown> & { $type: string }

export const prefMatchNamespace = (namespace: string, fullname: string) => {
  return fullname === namespace || fullname.startsWith(`${namespace}.`)
}
