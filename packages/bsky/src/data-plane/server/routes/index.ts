import { ConnectRouter } from '@connectrpc/connect'
import { IdResolver } from '@atproto/identity'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import activitySubscription from './activity-subscription'
import blocks from './blocks'
import bookmarks from './bookmarks'
import drafts from './drafts'
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
import profile from './profile'
import quotes from './quotes'
import records from './records'
import relationships from './relationships'
import reposts from './reposts'
import search from './search'
import sitemap from './sitemap'
import starterPacks from './starter-packs'
import suggestions from './suggestions'
import sync from './sync'
import threads from './threads'

export default (db: Database, idResolver: IdResolver) =>
  (router: ConnectRouter) =>
    router.service(Service, {
      ...activitySubscription(db),
      ...blocks(db),
      ...bookmarks(db),
      ...drafts(db),
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
      ...profile(db),
      ...quotes(db),
      ...records(db),
      ...relationships(db),
      ...reposts(db),
      ...search(db),
      ...sitemap(),
      ...suggestions(db),
      ...sync(db),
      ...threads(db),
      ...starterPacks(db),

      async ping() {
        return {}
      },
    })
