import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
import {
  LocalViewer,
  handleReadAfterWrite,
  LocalRecords,
} from '../../../../read-after-write'
import { pipethrough } from '../../../../pipethrough'

const METHOD_NSID = 'app.bsky.feed.getActorLikes'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.feed.getActorLikes({
    auth: ctx.authVerifier.access,
    handler: async ({ req, auth }) => {
      const requester = auth.credentials.did
      const res = await pipethrough(ctx, req, requester)

      if (!requester) {
        return res
      }

      return await handleReadAfterWrite(
        ctx,
        METHOD_NSID,
        requester,
        res,
        getAuthorMunge,
      )
    },
  })
}

const getAuthorMunge = async (
  localViewer: LocalViewer,
  original: OutputSchema,
  local: LocalRecords,
  requester: string,
): Promise<OutputSchema> => {
  const localProf = local.profile
  let feed = original.feed
  // first update any out of date profile pictures in feed
  if (localProf) {
    feed = feed.map((item) => {
      if (item.post.author.did === requester) {
        return {
          ...item,
          post: {
            ...item.post,
            author: localViewer.updateProfileViewBasic(
              item.post.author,
              localProf.record,
            ),
          },
        }
      } else {
        return item
      }
    })
  }
  return {
    ...original,
    feed,
  }
}
