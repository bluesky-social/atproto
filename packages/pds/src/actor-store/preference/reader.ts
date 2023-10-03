import { ActorDb } from '../actor-db'

export class PreferenceReader {
  constructor(public db: ActorDb) {}

  async getPreferences(namespace?: string): Promise<UserPreference[]> {
    const prefsRes = await this.db.db
      .selectFrom('user_pref')
      .orderBy('id')
      .selectAll()
      .execute()
    return prefsRes
      .filter((pref) => !namespace || prefMatchNamespace(namespace, pref.name))
      .map((pref) => JSON.parse(pref.valueJson))
  }
}

export type UserPreference = Record<string, unknown> & { $type: string }

export const prefMatchNamespace = (namespace: string, fullname: string) => {
  return fullname === namespace || fullname.startsWith(`${namespace}.`)
}
