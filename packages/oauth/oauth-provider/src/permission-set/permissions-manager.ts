import { resolveLexicon } from '@atproto/lexicon-resolver'
import { NSID } from '@atproto/syntax'
import { Fetch } from '@atproto-labs/fetch'
import { PermissionSet, permissionSetSchema } from './permission-set.js'

const isNonNullable = <X>(x: X): x is NonNullable<X> => x != null

function parseNSID(value: string): NSID | null {
  try {
    return new NSID(value)
  } catch {
    return null
  }
}

export class PermissionManager {
  constructor(private readonly safeFetch: Fetch) {}

  async resolveFromScope(scope: string) {
    const nsids = Array.from(new Set(scope.split(' ')), parseNSID).filter(
      isNonNullable,
    )

    return new Map<string, PermissionSet>(
      await Promise.all(
        nsids.map(
          async (nsid) => [nsid.toString(), await this.resolve(nsid)] as const,
        ),
      ),
    )
  }

  async resolve(
    nsid: NSID,
    options?: {
      noCache?: boolean
    },
  ): Promise<PermissionSet> {
    const { lexicon } = await resolveLexicon(nsid, {
      rpc: { fetch: this.safeFetch },
      forceRefresh: options?.noCache,
    })

    const permissionSet = permissionSetSchema.parse(lexicon?.defs?.['main'])

    // Validate the permission set against the NSID authority
    for (const permission of permissionSet.permissions) {
      if (permission.resource === 'repo') {
        for (const collection of permission.collection) {
          if (collection.authority !== nsid.authority) {
            // @TODO Better error
            throw new Error(
              `Collection ${collection} is not in the same authority as ${nsid.authority}`,
            )
          }
        }
      }

      if (permission.resource === 'rpc') {
        for (const lxm of permission.lxm) {
          if (lxm.authority !== nsid.authority) {
            // @TODO Better error
            throw new Error(
              `Lexicon ${lxm} is not in the same authority as ${nsid.authority}`,
            )
          }
        }
      }
    }

    return permissionSet
  }
}
