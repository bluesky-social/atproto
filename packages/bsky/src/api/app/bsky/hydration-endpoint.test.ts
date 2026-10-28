import { describe, expect, it, vi } from 'vitest'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import type { Hydrator } from '../../../hydration/hydrator.js'
import { app } from '../../../lexicons/index.js'
import getBookmarks from './bookmark/getBookmarks.js'
import getActorLikes from './feed/getActorLikes.js'
import getAuthorFeed from './feed/getAuthorFeed.js'
import getFeed from './feed/getFeed.js'
import getListFeed from './feed/getListFeed.js'
import getPostThread from './feed/getPostThread.js'
import getPosts from './feed/getPosts.js'
import getQuotes from './feed/getQuotes.js'
import getTimeline from './feed/getTimeline.js'
import searchPosts from './feed/searchPosts.js'
import searchPostsV2 from './feed/searchPostsV2.js'
import getGroupedNotifications from './notification/getGroupedNotifications.js'
import getPostThreadOtherV2 from './unspecced/getPostThreadOtherV2.js'
import getPostThreadV2 from './unspecced/getPostThreadV2.js'

const routes = [
  { schema: app.bsky.feed.getActorLikes, register: getActorLikes },
  { schema: app.bsky.feed.getAuthorFeed, register: getAuthorFeed },
  { schema: app.bsky.feed.getFeed, register: getFeed },
  { schema: app.bsky.feed.getListFeed, register: getListFeed },
  { schema: app.bsky.feed.getPostThread, register: getPostThread },
  { schema: app.bsky.feed.getPosts, register: getPosts },
  { schema: app.bsky.feed.getQuotes, register: getQuotes },
  { schema: app.bsky.feed.getTimeline, register: getTimeline },
  { schema: app.bsky.feed.searchPosts, register: searchPosts },
  { schema: app.bsky.feed.searchPostsV2, register: searchPostsV2 },
  { schema: app.bsky.unspecced.getPostThreadV2, register: getPostThreadV2 },
  {
    schema: app.bsky.unspecced.getPostThreadOtherV2,
    register: getPostThreadOtherV2,
  },
  { schema: app.bsky.bookmark.getBookmarks, register: getBookmarks },
  {
    schema: app.bsky.notification.getGroupedNotifications,
    register: getGroupedNotifications,
  },
]

type HandlerInput = {
  params: object
  auth: { credentials: { iss: string } }
  req: { header: () => undefined }
}

describe('post hydration endpoint attribution', () => {
  it.each(routes)(
    'passes $schema.$lxm to hydration',
    async ({ schema, register }) => {
      const sentinel = new Error('stop at createContext')
      const createContext = vi
        .fn<Hydrator['createContext']>()
        .mockRejectedValue(sentinel)
      const add = vi.fn(
        (
          _schema: { $lxm: string },
          _config: {
            handler: (input: HandlerInput) => Promise<unknown>
          },
        ) => {},
      )
      const features = { Gate: { AATest: 'AATest' }, checkGate: () => false }
      const ctx = {
        authVerifier: {
          standardOptional: () => {},
          standard: () => {},
          optionalStandardOrRole: () => {},
          standardOptionalParameterized: () => () => {},
          parseCreds: () => ({ viewer: 'did:plc:viewer' }),
        },
        reqLabelers: () => ({ dids: [], redact: new Set() }),
        featureGatesClient: {
          parseUserContextFromHandler: () => ({}),
          scope: () => features,
        },
        hydrator: { createContext },
      }
      register({ add } as unknown as Server, ctx as unknown as AppContext)

      expect(add).toHaveBeenCalledTimes(1)
      const [registeredSchema, { handler }] = add.mock.calls[0]
      expect(registeredSchema).toBe(schema)
      await expect(
        handler({
          params: {},
          auth: { credentials: { iss: 'did:plc:viewer' } },
          req: { header: () => undefined },
        }),
      ).rejects.toBe(sentinel)
      expect(createContext).toHaveBeenCalledTimes(1)
      expect(createContext).toHaveBeenCalledWith(
        expect.objectContaining({ xrpcEndpoint: schema.$lxm }),
      )
    },
  )
})
