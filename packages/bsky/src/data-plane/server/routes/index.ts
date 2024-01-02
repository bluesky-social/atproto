import { ConnectRouter } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'

import blocks from './blocks'
import feedGens from './feed-gens'
import feeds from './feeds'
import follows from './follows'
import interactions from './interactions'
import labels from './labels'
import likes from './likes'
import lists from './lists'
import moderation from './moderation'
import mutes from './mutes'
import notifs from './notifs'
import posts from './posts'
import profile from './profile'
import records from './records'
import relationships from './relationships'
import reposts from './reposts'
import search from './search'
import suggestions from './suggestions'
import sync from './sync'
import threads from './threads'
import { Database } from '../db'

export default (db: Database) => (router: ConnectRouter) =>
  router.service(Service, {
    ...blocks(db),
    ...feedGens(db),
    ...feeds(db),
    ...follows(db),
    ...interactions(db),
    ...labels(db),
    ...likes(db),
    ...lists(db),
    ...moderation(db),
    ...mutes(db),
    ...notifs(db),
    ...posts(db),
    ...profile(db),
    ...records(db),
    ...relationships(db),
    ...reposts(db),
    ...search(db),
    ...suggestions(db),
    ...sync(db),
    ...threads(db),

    async ping() {
      return {}
    },
  })
