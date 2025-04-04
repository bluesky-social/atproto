import { ConnectRouter } from '@connectrpc/connect'
import { IdResolver } from '@atproto/identity'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import blocks from './blocks'
import feedGens from './feed-gens'
import feeds from './feeds'
import follows from './follows'
import identity from './identity'
import interactions from './interactions'
import labels from './labels'
import likes from './likes'
import lists from './lists'
import moderation from './moderation'
import mutes from './mutes'
import notifs from './notifs'
import posts from './posts'
import profile from './profile'
import quotes from './quotes'
import records from './records'
import relationships from './relationships'
import reposts from './reposts'
import search from './search'
import starterPacks from './starter-packs'
import suggestions from './suggestions'
import sync from './sync'
import threads from './threads'

export default (db: Database, idResolver: IdResolver) =>
  (router: ConnectRouter) =>
    router.service(Service, {
      ...blocks(db),
      ...feedGens(db),
      ...feeds(db),
      ...follows(db),
      ...identity(db, idResolver),
      ...interactions(db),
      ...labels(db),
      ...likes(db),
      ...lists(db),
      ...moderation(db),
      ...mutes(db),
      ...notifs(db),
      ...posts(db),
      ...profile(db),
      ...quotes(db),
      ...records(db),
      ...relationships(db),
      ...reposts(db),
      ...search(db),
      ...suggestions(db),
      ...sync(db),
      ...threads(db),
      ...starterPacks(db),

      async ping() {
        return {}
      },
    })
