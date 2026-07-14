import type { ConnectRouter } from '@connectrpc/connect'
import type { IdResolver } from '@atproto/identity'
import { Service } from '../../../proto/bsky_connect.js'
import type { Database } from '../db/index.js'
import activitySubscription from './activity-subscription.js'
import blocks from './blocks.js'
import bookmarks from './bookmarks.js'
import drafts from './drafts.js'
import feedGens from './feed-gens.js'
import feeds from './feeds.js'
import follows from './follows.js'
import identity from './identity.js'
import interactions from './interactions.js'
import labels from './labels.js'
import likes from './likes.js'
import lists from './lists.js'
import moderation from './moderation.js'
import mutes from './mutes.js'
import notifs from './notifs.js'
import profile from './profile.js'
import quotes from './quotes.js'
import records from './records.js'
import relationships from './relationships.js'
import reposts from './reposts.js'
import search from './search.js'
import siteStandard from './site-standard.js'
import sitemap from './sitemap.js'
import starterPacks from './starter-packs.js'
import suggestions from './suggestions.js'
import sync from './sync.js'
import threads from './threads.js'

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
      ...siteStandard(db),
      ...suggestions(db),
      ...sync(db),
      ...threads(db),
      ...starterPacks(db),

      async ping() {
        return {}
      },
    })
