import { ConnectRouter } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'

import blocks from './blocks'
import feedGens from './feed-gens'
import feeds from './feeds'
import follows from './follows'
import labels from './labels'
import likes from './likes'
import lists from './lists'
import moderation from './moderation'
import mutes from './mutes'
import notifs from './notifs'
import posts from './posts'
import profile from './profile'
import reposts from './reposts'
import search from './search'
import suggestions from './suggestions'
import sync from './sync'
import threads from './threads'

export default (router: ConnectRouter) =>
  router.service(Service, {
    ...blocks,
    ...feedGens,
    ...feeds,
    ...follows,
    ...labels,
    ...likes,
    ...lists,
    ...moderation,
    ...mutes,
    ...notifs,
    ...posts,
    ...profile,
    ...reposts,
    ...search,
    ...suggestions,
    ...sync,
    ...threads,

    async ping() {
      return {}
    },
  })
