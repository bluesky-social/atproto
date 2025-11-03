import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.listFollowRequests({
    auth: ctx.authVerifier.authorization({
      authorize: (permissions) => {
        const lxm = ids.AppBskyGraphListFollowRequests
        permissions.assertRpc({ aud: null as unknown as string, lxm })
      },
    }),
    handler: async ({ auth, params }) => {
      const userDid = auth.credentials.did
      const {
        direction = 'incoming',
        status = 'pending',
        limit = 50,
        cursor,
      } = params

      let requests: any[] = []

      if (direction === 'outgoing') {
        // Get requests made by this user (outgoing)
        const records = await ctx.actorStore.read(userDid, async (store) => {
          return store.record.listRecordsForCollection({
            collection: 'app.bsky.graph.followRequest',
            limit: limit + 1,
            after: cursor,
          })
        })

        requests = records
          .filter((r) => {
            const record = r.value as any
            if (status === 'all') return true
            return record.status === status
          })
          .map((r) => {
            const record = r.value as any
            return {
              uri: r.uri,
              cid: r.cid,
              requester: { did: userDid },
              subject: record.subject,
              status: record.status,
              createdAt: record.createdAt,
              respondedAt: record.respondedAt,
            }
          })
      } else {
        // Get requests to follow this user (incoming)
        const backlinks = await ctx.actorStore.read(userDid, async (store) => {
          return store.record.getRecordBacklinks({
            collection: 'app.bsky.graph.followRequest',
            path: 'subject',
            linkTo: userDid,
          })
        })

        // Fetch full record details for each backlink
        for (const backlink of backlinks.slice(0, limit + 1)) {
          try {
            const uriParts = backlink.uri.split('/')
            const requesterDid = uriParts[2]
            const rkey = uriParts[4]

            const record = await ctx.actorStore.read(
              requesterDid,
              async (store) => {
                return store.record.getRecord(
                  'app.bsky.graph.followRequest',
                  rkey,
                )
              },
            )

            if (record) {
              const recordValue = record.value as any
              if (status === 'all' || recordValue.status === status) {
                requests.push({
                  uri: backlink.uri,
                  cid: record.cid,
                  requester: { did: requesterDid },
                  subject: recordValue.subject,
                  status: recordValue.status,
                  createdAt: recordValue.createdAt,
                  respondedAt: recordValue.respondedAt,
                })
              }
            }
          } catch (err) {
            // Skip records that can't be fetched
            continue
          }
        }
      }

      // Handle pagination
      let nextCursor: string | undefined
      if (requests.length > limit) {
        nextCursor = requests[limit].uri
        requests = requests.slice(0, limit)
      }

      // Enrich with profile data for requesters
      const enrichedRequests = await Promise.all(
        requests.map(async (req) => {
          try {
            const requesterDid =
              typeof req.requester === 'string'
                ? req.requester
                : req.requester.did

            // Resolve DID to handle
            let handle = requesterDid
            try {
              const didDoc = await ctx.idResolver.did.resolve(requesterDid)
              if (didDoc) {
                // Extract handle from DID document alsoKnownAs
                const handleFromDoc = didDoc.alsoKnownAs?.find((aka) =>
                  aka.startsWith('at://'),
                )
                if (handleFromDoc) {
                  handle = handleFromDoc.replace('at://', '')
                }
              }
            } catch (err) {
              // If resolution fails, fall back to DID
            }

            // Get display name and avatar from profile record if available
            let displayName: string | undefined
            let avatar: string | undefined
            try {
              const profile = await ctx.actorStore.read(
                requesterDid,
                async (store) => {
                  return store.record.getRecord(
                    'app.bsky.actor.profile',
                    'self',
                  )
                },
              )
              if (profile) {
                const profileData = profile.value as any
                displayName = profileData.displayName
                avatar = profileData.avatar
              }
            } catch (err) {
              // Profile record not found or inaccessible
            }

            return {
              uri: req.uri,
              cid: req.cid,
              requester: {
                did: requesterDid,
                handle,
                displayName,
                avatar,
              },
              subject: req.subject,
              status: req.status,
              createdAt: req.createdAt,
              respondedAt: req.respondedAt,
            }
          } catch (err) {
            // On any error, return request with minimal data
            return {
              ...req,
              requester: {
                did:
                  typeof req.requester === 'string'
                    ? req.requester
                    : req.requester.did,
                handle:
                  typeof req.requester === 'string'
                    ? req.requester
                    : req.requester.did,
              },
            }
          }
        }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          requests: enrichedRequests,
          cursor: nextCursor,
        },
      }
    },
  })
}
