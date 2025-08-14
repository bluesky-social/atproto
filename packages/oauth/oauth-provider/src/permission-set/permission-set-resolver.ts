import { resolveLexicon } from '@atproto/lexicon-resolver'
import { NSID } from '@atproto/syntax'
import { Fetch } from '@atproto-labs/fetch'
import { PermissionSet, permissionSetSchema } from './permission-set.js'

export class PermissionSetResolver {
  constructor(private readonly safeFetch: Fetch) {}

  async resolve(
    nsidStr: string,
    options?: {
      noCache?: boolean
    },
  ): Promise<PermissionSet> {
    const nsid = NSID.parse(nsidStr)

    const { lexicon } = await resolveLexicon(nsid, {
      rpc: { fetch: this.safeFetch },
      forceRefresh: options?.noCache,
    })

    return permissionSetSchema.parse(lexicon?.defs?.['main'])
  }
}
