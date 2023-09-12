import { generateMockSetup } from './mock'
import { TestNetwork } from './network'

const run = async () => {
  console.log(`
██████╗
██╔═══██╗
██║██╗██║
██║██║██║
╚█║████╔╝
 ╚╝╚═══╝  protocol

[ created by Bluesky ]`)

  const network = await TestNetwork.create({
    pds: {
      port: 2583,
      publicUrl: 'http://localhost:2583',
      enableLabelsCache: true,
      dbPostgresSchema: 'pds',
    },
    bsky: {
      dbPostgresSchema: 'bsky',
    },
    plc: { port: 2582 },
  })
  await enableProxy(network)
  await generateMockSetup(network)

  console.log(
    `👤 DID Placeholder server started http://localhost:${network.plc.port}`,
  )
  console.log(
    `🌞 Personal Data server started http://localhost:${network.pds.port}`,
  )
  console.log(`🌅 Bsky Appview started http://localhost:${network.bsky.port}`)
  for (const fg of network.feedGens) {
    console.log(`🤖 Feed Generator started http://localhost:${fg.port}`)
  }
}

run()

// @TODO remove once we remove proxy runtime flags
const enableProxy = async (network: TestNetwork) => {
  const flags = [
    'appview-proxy:app.bsky.feed.getAuthorFeed',
    'appview-proxy:app.bsky.graph.getFollowers',
    'appview-proxy:app.bsky.feed.getPosts',
    'appview-proxy:app.bsky.graph.getFollows',
    'appview-proxy:app.bsky.feed.getLikes',
    'appview-proxy:app.bsky.feed.getRepostedBy',
    'appview-proxy:app.bsky.feed.getPostThread',
    'appview-proxy:app.bsky.actor.getProfile',
    'appview-proxy:app.bsky.actor.getProfiles',
    'appview-proxy:app.bsky.feed.getTimeline',
    'appview-proxy:app.bsky.feed.getSuggestions',
    'appview-proxy:app.bsky.feed.getFeed',
    'appview-proxy:app.bsky.feed.getActorFeeds',
    'appview-proxy:app.bsky.feed.getActorLikes',
    'appview-proxy:app.bsky.feed.getFeedGenerator',
    'appview-proxy:app.bsky.feed.getFeedGenerators',
    'appview-proxy:app.bsky.feed.getBlocks',
    'appview-proxy:app.bsky.feed.getList',
    'appview-proxy:app.bsky.notification.listNotifications',
    'appview-proxy:app.bsky.feed.getLists',
    'appview-proxy:app.bsky.feed.getListMutes',
    'appview-proxy:com.atproto.repo.getRecord',
    'appview-proxy:com.atproto.identity.resolveHandle',
    'appview-proxy:app.bsky.notification.getUnreadCount',
    'appview-proxy:app.bsky.actor.searchActorsTypeahead',
    'appview-proxy:app.bsky.actor.searchActors',
  ]
  await network.pds.ctx.db.db
    .insertInto('runtime_flag')
    .values(flags.map((name) => ({ name, value: '10' })))
    .execute()
}
