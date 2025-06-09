import { InvalidRequestError } from '@atproto/oauth-provider'
//import { AtUri } from '@atproto/syntax'
import {
  genDomainPrefix,
  inferPubHandle,
  makeImageURL,
  makeLDContext,
  makeObject,
} from '../../../../activitypub/util'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
//import { ids } from '../../../../lexicon/lexicons'
//import { pipethrough } from '../../../../pipethrough'
import { Record as ProfileRecord } from '../../../../lexicon/types/app/bsky/actor/profile'

export default function (server: Server, ctx: AppContext) {
  server.org.w3.activitypub.getActor({
    //auth: ctx.authVerifier.accessStandard(),
    handler: async ({ params, /*auth,*/ req }) => {
      const { repo } = params

      const atUser = await ctx.accountManager.getAccount(repo)
      if (!atUser) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      } else if (!atUser.handle) {
        throw new InvalidRequestError(
          `Unable to read handle from repo: ${repo}`,
        )
      }
      const did = atUser.did

      let profile: ProfileRecord | undefined
      await ctx.actorStore.read(did, async (actor) => {
        profile = (await actor.record.getProfileRecord()) as ProfileRecord
      })
      if (!profile) {
        throw new InvalidRequestError(
          `Unable to fetch profile from repo: ${repo}`,
        )
      }

      const uriPrefix = `${genDomainPrefix(ctx, req)}/xrpc`
      const pubHandle = inferPubHandle(ctx, req.hostname, atUser.handle)

      const apResponse = {
        type: 'Person',
        id: `${uriPrefix}/org.w3.activitypub.getActor?repo=${did}`,
        //atUri: `at://${did}/org.w3.activitypub.actor`,
        inbox: `${uriPrefix}/org.w3.activitypub.putInbox?repo=${did}`,
        outbox: `${uriPrefix}/org.w3.activitypub.getOutbox?repo=${did}`,
        //followers: `${uriPrefix}/org.w3.activitypub.getFollowers?repo=${did}`,
        //following: `${uriPrefix}/org.w3.activitypub.getFollowing?repo=${did}`,
        preferredUsername: pubHandle.split('@')[0],
        name: profile.displayName,
        summary: profile.description,
        icon: profile.avatar
          ? makeObject({
              type: 'Image',
              mediaType: profile.avatar.mimeType,
              url: makeImageURL(
                'avatar',
                did,
                profile.avatar.ref.toString(),
                profile.avatar.mimeType,
              ),
            })
          : undefined,
        image: profile.banner
          ? makeObject({
              type: 'Image',
              mediaType: profile.banner.mimeType,
              url: makeImageURL(
                'banner',
                did,
                profile.banner.ref.toString(),
                profile.banner.mimeType,
              ),
            })
          : undefined,
      }

      return {
        encoding: 'application/activity+json', // 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
        body: {
          '@context': makeLDContext(apResponse),
          ...apResponse,
        },
      }
    },
  })
}
