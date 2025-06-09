import { InvalidRequestError } from '@atproto/oauth-provider'
//import { AtUri } from '@atproto/syntax'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
//import { pipethrough } from '../../../../pipethrough'
import { RepoRecord } from '@atproto/lexicon'
import { Record as ProfileRecord } from '../../../../lexicon/types/app/bsky/actor/profile'
import {
  genDomainPrefix,
  inferPubHandle,
  makeImageURL,
  makeLDContext,
  makeObject,
  atUriToTID,
  makeNote,
  makeActivity
} from '../../../../activitypub/util'
import { Record as FeedPostRecord } from '../../../../lexicon/types/app/bsky/feed/post'



export default function (server: Server, ctx: AppContext) {
  server.org.w3.activitypub.getOutbox({
    //auth: ctx.authVerifier.accessStandard(),
    handler: async ({ params, /*auth,*/ req }) => {
      const { repo, page } = params

      const atUser = await ctx.accountManager.getAccount(repo)
      if (!atUser) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      }
      else if (!atUser.handle) {
        throw new InvalidRequestError(`Unable to read handle from repo: ${repo}`)
      }
      const did = atUser.did

      let profile: ProfileRecord | undefined
      await ctx.actorStore.read(did, async (actor) => {
        profile = (await actor.record.getProfileRecord()) as ProfileRecord
      })
      if (!profile) {
        throw new InvalidRequestError(`Unable to fetch profile from repo: ${repo}`)
      }

      const uriPrefix = `${genDomainPrefix(ctx, req)}/xrpc`
      const pubHandle = inferPubHandle(ctx, req.hostname, atUser.handle)

      let apResponse = {}

      // Get posts belonging to the user
      let postRecord: {
        uri: string
        cid: string
        value: RepoRecord
      }[] = []
      await ctx.actorStore.read(did, async (actor) => {
        postRecord = await actor.record.listRecordsForCollection({
        collection: ids.AppBskyFeedPost,
        limit: 10,
        reverse: false,
        })
      })

      /*
      if (page) {
        // TODO: sanitize page

        // Convert posts into Activities and Notes
        const items = postRecord.map((key) => {
          const pr = key.value as FeedPostRecord
          //const er = pr ? (pr.embed as EmbedRecord) : undefined
          //const cm = er ? (er.record as CreateOutputSchema) : undefined

          const tid = atUriToTID(key.uri)

          return makeActivity(
            'Create',
            {
              uriHandle: pubHandle,
              postId: tid ?? 'NOT_FOUND',
              //postId: cm && cm.commit ? cm.commit.rev : 'NOT_FOUND',
              published: pr.createdAs as string,
              id: key.uri,
              cid: key.cid,
            },
            makeNote(
              {
                uriHandle: pubHandle,
                postId: tid ?? 'NOT_FOUND',
                //postId: cm && cm.commit ? cm.commit.rev : 'NOT_FOUND',
                published: key.value.createdAs as string,
                id: key.uri,
                cid: key.cid,
              },
              `<p>${key.value.text as string}</p>`,
            ),
          )
        })

        apResponse = {
          type: 'OrderedCollectionPage',
          id: `${uriPrefix}/org.w3.activitypub.getOutbox?repo=${did}&page=true`,
          //atUri: `at://${did}/org.w3.activitypub.getOutbox`,
          partOf: `${uriPrefix}/org.w3.activitypub.getOutbox?repo=${did}`,
          orderedItems: items,
          //next: '',
          //prev: '',
        }
      }
      else*/
      {
        apResponse = {
          type: 'OrderedCollection',
          id: `${uriPrefix}/org.w3.activitypub.getOutbox?repo=${did}`,
          //atUri: `at://${did}/org.w3.activitypub.getOutbox`,
          totalItems: postRecord.length,
          first: `${uriPrefix}/org.w3.activitypub.getOutbox?repo=${did}&page=true`,
          last: `${uriPrefix}/org.w3.activitypub.getOutbox?repo=${did}&page=true&min_id=0`,
        }
      }

      return {
        encoding: 'application/activity+json', // 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
        body: {
          $type: apResponse === "OrderedCollection" ? 'org.w3.activitystreams.orderedCollection' : 'org.w3.activitystreams.orderedCollectionPage',
          '@context': makeLDContext(apResponse),
          ...apResponse
        }
      }
    }
  })
}
