import type { DidString, UriString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import type { ActionView } from '../lexicons/tools/ozone/inbox/defs.js'
import { PolicyListSettingKey } from '../setting/constants.js'
import { SettingService } from '../setting/service.js'

export type ActionPolicy = NonNullable<ActionView['policies']>[number]

export type PolicyList = Record<string, unknown>

/** Load the instance policy list that is also exposed through listOptions. */
export async function loadPolicyList(
  db: Database,
  serviceDid: DidString,
): Promise<PolicyList> {
  const { options } = await new SettingService(db).query({
    limit: 1,
    scope: 'instance',
    did: serviceDid,
    keys: [PolicyListSettingKey],
  })
  return options[0]?.value ?? {}
}

export function toActionPolicies(
  keys: string[],
  policyList: PolicyList,
  defaultUrl: string,
): ActionPolicy[] {
  return keys.map((key) => {
    const config = policyList[key]
    const entry =
      config && typeof config === 'object'
        ? (config as Record<string, unknown>)
        : undefined
    return {
      key,
      displayName: typeof entry?.name === 'string' ? entry.name : key,
      link: (typeof entry?.url === 'string'
        ? entry.url
        : defaultUrl) as UriString,
    }
  })
}
