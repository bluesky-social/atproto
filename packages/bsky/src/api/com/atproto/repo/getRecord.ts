import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord(async ({ params }) => {
    const { repo, collection, rkey, cid } = params
    const [did] = await ctx.hydrator.actor.getDids([repo])
    if (!did) {
      throw new InvalidRequestError(`Could not find repo: ${repo}`)
    }

    const uri = AtUri.make(did, collection, rkey).toString()

    let result: { cid: CID; record: Record<string, unknown> } | null | undefined
    if (collection === ids.AppBskyFeedPost) {
      result = (await ctx.hydrator.feed.getPosts([uri])).get(uri)
    } else if (collection === ids.AppBskyFeedRepost) {
      result = (await ctx.hydrator.feed.getReposts([uri])).get(uri)
    } else if (collection === ids.AppBskyFeedLike) {
      result = (await ctx.hydrator.feed.getLikes([uri])).get(uri)
    } else if (collection === ids.AppBskyGraphFollow) {
      result = (await ctx.hydrator.graph.getFollows([uri])).get(uri)
    } else if (collection === ids.AppBskyGraphList) {
      result = (await ctx.hydrator.graph.getLists([uri])).get(uri)
    } else if (collection === ids.AppBskyGraphListitem) {
      result = (await ctx.hydrator.graph.getListItems([uri])).get(uri)
    } else if (collection === ids.AppBskyGraphBlock) {
      result = (await ctx.hydrator.graph.getBlocks([uri])).get(uri)
    } else if (collection === ids.AppBskyFeedGenerator) {
      result = (await ctx.hydrator.feed.getFeedGens([uri])).get(uri)
    } else if (collection === ids.AppBskyActorProfile) {
      const actor = (await ctx.hydrator.actor.getActors([did])).get(did)
      result =
        actor?.profile && actor?.profileCid
          ? { record: actor.profile, cid: actor.profileCid }
          : undefined
    }

    if (!result || (cid && result.cid.toString() !== cid)) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }

    return {
      encoding: 'application/json' as const,
      body: {
        uri: uri,
        cid: result.cid.toString(),
        value: result.record,
      },
    }
  })
}
