import { getServiceEndpoint } from '@atproto/common'
import { xrpc } from '@atproto/lex'
import { createSpaceToken, parseSpaceToken } from '@atproto/space'
import { AtUri, AtUriString, DidString } from '@atproto/syntax'
import {
  InvalidRequestError,
  Server,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpaceCredential, {
    auth: ctx.authVerifier.delegationTokenAuth,
    handler: async ({ input, auth }) => {
      const { space, clientAttestation } = input.body
      const { userDid, space: tokenSpace } = auth.credentials

      if (tokenSpace !== space) {
        throw new InvalidRequestError(
          'Delegation token subject does not match requested space',
          'InvalidDelegationToken',
        )
      }

      const { spaceDid } = new AtUri(space).asSpaceUri()

      // Parse the client attestation if present. Structural validation only.
      // @TODO Full verification means resolving `iss` (the client_id) to the
      // client's client-metadata.json, fetching its published JWKS, and checking
      // the signature against the key named by the attestation's `kid`. Until
      // then the attested client_id is advisory, so an allowList is only as
      // strong as the caller's honesty.
      let clientId: string | undefined
      if (clientAttestation) {
        try {
          const parsed = parseSpaceToken('clientAttestation', clientAttestation)
          clientId = parsed.payload.iss
        } catch (err) {
          throw new InvalidRequestError(
            `Invalid client attestation: ${err instanceof Error ? err.message : String(err)}`,
            'InvalidClientAttestation',
          )
        }
      }

      const { spaceRow, isMember } = await ctx.actorStore.read(
        spaceDid,
        async (store) => ({
          spaceRow: await store.space.getSpace(space),
          isMember: await store.space.isMember(space, userDid),
        }),
      )
      if (!spaceRow) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (spaceRow.deletedAt) {
        throw new InvalidRequestError('Space has been deleted', 'SpaceDeleted')
      }

      // User perimeter (policy).
      const userAuthorized = await checkUserAuthorized(ctx, {
        policy: spaceRow.policy,
        managingApp: spaceRow.managingApp,
        spaceDid,
        space,
        userDid,
        clientId,
        isMember,
      })
      if (!userAuthorized) {
        throw new InvalidRequestError(
          'User not authorized for this space',
          'UserNotAuthorized',
        )
      }

      // App perimeter (appAccess). #open allows any app; #allowList requires an
      // attested client_id present in the allow list.
      if (spaceRow.appAccessType === 'allowList') {
        if (!clientId || !spaceRow.appAllowed.includes(clientId)) {
          throw new InvalidRequestError(
            'Application not authorized for this space',
            'AppNotAuthorized',
          )
        }
      }

      const keypair = await ctx.actorStore.keypair(spaceDid)
      const credential = await createSpaceToken(
        'credential',
        { iss: spaceDid, sub: space },
        keypair,
      )

      return {
        encoding: 'application/json' as const,
        body: { credential },
      }
    },
  })
}

async function checkUserAuthorized(
  ctx: AppContext,
  opts: {
    policy: string
    managingApp: string | null
    spaceDid: string
    space: string
    userDid: string
    clientId?: string
    isMember: boolean
  },
): Promise<boolean> {
  switch (opts.policy) {
    case 'public':
      return true
    case 'member-list':
      return opts.isMember
    case 'managing-app':
      return checkManagingApp(ctx, opts)
    default:
      return false
  }
}

// Ask the space's managingApp whether to authorize the request, via
// com.atproto.simplespace.checkUserAccess. The authority calls with itself as
// iss and the managingApp service identifier as aud (service auth).
async function checkManagingApp(
  ctx: AppContext,
  opts: {
    managingApp: string | null
    spaceDid: string
    space: string
    userDid: string
    clientId?: string
  },
): Promise<boolean> {
  const { managingApp, spaceDid, space, userDid, clientId } = opts
  if (!managingApp) return false
  const [appDid, fragment] = managingApp.split('#')
  try {
    const didDoc = await ctx.idResolver.did.resolve(appDid)
    if (!didDoc) return false
    const endpoint = getServiceEndpoint(didDoc, {
      id: fragment ? `#${fragment}` : '',
    })
    if (!endpoint) return false

    const keypair = await ctx.actorStore.keypair(spaceDid)
    const { headers } = await createServiceAuthHeaders({
      iss: spaceDid,
      aud: managingApp,
      lxm: com.atproto.simplespace.checkUserAccess.$lxm,
      keypair,
    })
    const res = await xrpc(endpoint, com.atproto.simplespace.checkUserAccess, {
      headers,
      params: {
        space: space as AtUriString,
        user: userDid as DidString,
        clientId,
      },
    })
    return res.body.authorized === true
  } catch {
    return false
  }
}
