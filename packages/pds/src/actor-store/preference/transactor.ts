import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  AccountPreference,
  PreferenceReader,
  prefMatchNamespace,
} from './reader'
import { PrefAllowedOptions, isReadOnlyPref, prefAllowed } from './util'

export class PreferenceTransactor extends PreferenceReader {
  async putPreferences(
    values: AccountPreference[],
    namespace: string,
    opts: PrefAllowedOptions,
  ): Promise<void> {
    this.db.assertTransaction()
    if (!values.every((value) => prefMatchNamespace(namespace, value.$type))) {
      throw new InvalidRequestError(
        `Some preferences are not in the ${namespace} namespace`,
      )
    }
    const forbiddenPrefs = values.filter((val) => !prefAllowed(val.$type, opts))
    if (forbiddenPrefs.length > 0) {
      throw new InvalidRequestError(
        `Do not have authorization to set preferences: ${forbiddenPrefs.map((p) => p.$type).join(', ')}`,
      )
    }
    // get all current prefs for user and prep new pref rows
    const allPrefs = await this.db.db
      .selectFrom('account_pref')
      .select(['id', 'name'])
      .execute()
    const putPrefs = values
      .filter((value) => !isReadOnlyPref(value.$type))
      .map((value) => {
        return {
          name: value.$type,
          valueJson: JSON.stringify(value),
        }
      })
    const allPrefIdsInNamespace = allPrefs
      .filter((pref) => prefMatchNamespace(namespace, pref.name))
      .filter((pref) => prefAllowed(pref.name, opts))
      .map((pref) => pref.id)
    // replace all prefs in given namespace
    if (allPrefIdsInNamespace.length) {
      await this.db.db
        .deleteFrom('account_pref')
        .where('id', 'in', allPrefIdsInNamespace)
        .execute()
    }
    if (putPrefs.length) {
      await this.db.db.insertInto('account_pref').values(putPrefs).execute()
    }
  }
}
