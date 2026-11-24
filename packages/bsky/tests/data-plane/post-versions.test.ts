import * as ui8 from 'uint8arrays'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AppBskyFeedGetPostVersions,
  type AppBskyFeedPost,
  type AtpAgent,
  ids,
} from '@atproto/api'
import { TID, cidForCbor } from '@atproto/common'
import { type SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import type { Cid } from '@atproto/lex'
import { lexParse } from '@atproto/lex-json'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import type { IndexingService } from '../../src/data-plane/server/indexing/index.js'
import { app, com } from '../../src/lexicons/index.js'

describe('post version data plane', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_data_plane_post_versions',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
    await network.bsky.sub.stop()
  })

  afterAll(async () => network?.close())

  it('stores only an accepted edit and clears history on delete and recreate', async () => {
    const indexedAt = new Date('2026-01-01T00:00:00.000Z')
    const uri = AtUri.make(
      sc.dids.alice,
      app.bsky.feed.post.$type,
      TID.nextStr(),
    )
    const original = versionedPost('original', indexedAt.toISOString(), [
      'original-label',
    ])
    const originalCid = await cidForCbor(original)
    await network.bsky.sub.indexingSvc.indexRecord(
      uri,
      originalCid,
      original,
      WriteOpAction.Create,
      indexedAt.toISOString(),
    )
    const quoteUri = AtUri.make(
      sc.dids.bob,
      app.bsky.feed.post.$type,
      TID.nextStr(),
    )
    const quoteRecord: AppBskyFeedPost.Record = {
      ...post('quote', indexedAt.toISOString()),
      embed: app.bsky.embed.record.main.$build({
        record: com.atproto.repo.strongRef.main.$build({
          uri: uri.toString(),
          cid: originalCid.toString(),
        }),
      }),
    }
    await network.bsky.sub.indexingSvc.indexRecord(
      quoteUri,
      await cidForCbor(quoteRecord),
      quoteRecord,
      WriteOpAction.Create,
      indexedAt.toISOString(),
    )

    const invalid = { ...original, createdAt: new Date(0).toISOString() }
    await expect(
      network.bsky.sub.indexingSvc.indexRecord(
        uri,
        await cidForCbor(invalid),
        invalid,
        WriteOpAction.Update,
        new Date(indexedAt.getTime() + 500).toISOString(),
      ),
    ).rejects.toMatchObject({ name: 'InvalidPostEditError' })

    const editedAt = new Date(indexedAt.getTime() + 1000)
    const edited = versionedPost('edited', indexedAt.toISOString(), [
      'original-label',
      'edited-label',
    ])
    const editedCid = await cidForCbor(edited)
    await network.bsky.sub.indexingSvc.indexRecord(
      uri,
      editedCid,
      edited,
      WriteOpAction.Update,
      editedAt.toISOString(),
    )

    const { versions } = await network.bsky.ctx.dataplane.getPostVersions({
      uri: uri.toString(),
    })
    expect(versions.map((version) => version.cid)).toEqual([
      editedCid.toString(),
      originalCid.toString(),
    ])
    expect(
      versions.map(
        (version) =>
          (lexParse(ui8.toString(version.record, 'utf8')) as { text: string })
            .text,
      ),
    ).toEqual(['edited', 'original'])
    expect(versions[0].indexedAt?.toDate()).toEqual(indexedAt)
    expect(versions[1].indexedAt?.toDate()).toEqual(indexedAt)
    expect(versions[0].editedAt?.toDate()).toEqual(editedAt)
    expect(versions[1].editedAt).toBeUndefined()
    expect(
      await network.bsky.ctx.dataplane.getPostVersionCounts({
        refs: [{ uri: uri.toString(), cid: originalCid.toString() }],
      }),
    ).toMatchObject({ counts: [{ quotes: 1 }] })

    const response = await agent.app.bsky.feed.getPostVersions(
      { uri: uri.toString() },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostVersions,
        ),
      },
    )
    expect(response.data.uri).toBe(uri.toString())
    expect(
      response.data.versions.map((version) => ({
        cid: version.cid,
        text: (version.record as AppBskyFeedPost.Record).text,
        indexedAt: version.indexedAt,
        editedAt: version.editedAt,
        quoteCount: version.quoteCount,
      })),
    ).toEqual([
      {
        cid: editedCid.toString(),
        text: 'edited',
        indexedAt: indexedAt.toISOString(),
        editedAt: editedAt.toISOString(),
        quoteCount: 0,
      },
      {
        cid: originalCid.toString(),
        text: 'original',
        indexedAt: indexedAt.toISOString(),
        editedAt: undefined,
        quoteCount: 1,
      },
    ])
    for (const version of response.data.versions) {
      expect(version).toMatchObject({
        embed: { external: { title: 'versioned post' } },
      })
    }
    expect(response.data.versions[0].labels?.map((label) => label.val)).toEqual(
      ['original-label', 'edited-label'],
    )
    expect(response.data.versions[1].labels?.map((label) => label.val)).toEqual(
      ['original-label'],
    )
    for (const version of response.data.versions) {
      expect(version).not.toHaveProperty('viewCount')
      expect(version.viewer).toBeDefined()
      expect(version.viewer).not.toHaveProperty('like')
      expect(version.viewer).not.toHaveProperty('repost')
      expect(version.viewer).not.toHaveProperty('bookmarked')
    }

    const current = await agent.app.bsky.feed.getPostThread({
      uri: uri.toString(),
    })
    expect(current.data.thread).toMatchObject({
      post: {
        cid: editedCid.toString(),
        editedAt: editedAt.toISOString(),
        quoteCount: 1,
      },
    })
    const quote = await agent.app.bsky.feed.getPostThread({
      uri: quoteUri.toString(),
    })
    expect(quote.data.thread).toMatchObject({
      post: {
        embed: {
          record: { editedAt: editedAt.toISOString() },
        },
      },
    })

    const secondEdit = { ...edited, text: 'second edit' }
    await expect(
      network.bsky.sub.indexingSvc.indexRecord(
        uri,
        await cidForCbor(secondEdit),
        secondEdit,
        WriteOpAction.Update,
        new Date(indexedAt.getTime() + 2000).toISOString(),
      ),
    ).rejects.toMatchObject({ name: 'PostEditLimitError' })

    await network.bsky.sub.indexingSvc.deleteRecord(uri)
    expect(
      await network.bsky.ctx.dataplane.getPostVersions({ uri: uri.toString() }),
    ).toEqual({ versions: [] })
    expect(
      await network.bsky.ctx.dataplane.getPostVersionCounts({
        refs: [{ uri: uri.toString(), cid: originalCid.toString() }],
      }),
    ).toMatchObject({ counts: [{ quotes: 0 }] })
    await expect(
      agent.app.bsky.feed.getPostVersions({ uri: uri.toString() }),
    ).rejects.toBeInstanceOf(AppBskyFeedGetPostVersions.NotFoundError)

    const recreated = post('recreated', indexedAt.toISOString())
    const recreatedCid = await cidForCbor(recreated)
    await network.bsky.sub.indexingSvc.indexRecord(
      uri,
      recreatedCid,
      recreated,
      WriteOpAction.Create,
      new Date(indexedAt.getTime() + 3000).toISOString(),
    )
    const recreatedHistory = await network.bsky.ctx.dataplane.getPostVersions({
      uri: uri.toString(),
    })
    expect(recreatedHistory.versions.map((version) => version.cid)).toEqual([
      recreatedCid.toString(),
    ])
    expect(recreatedHistory.versions[0].editedAt).toBeUndefined()
    const recreatedResponse = await agent.app.bsky.feed.getPostVersions({
      uri: uri.toString(),
    })
    expect(recreatedResponse.data.versions).toHaveLength(1)
    expect(recreatedResponse.data.versions[0].cid).toBe(recreatedCid.toString())
    expect(recreatedResponse.data.versions[0]).not.toHaveProperty('editedAt')
  })

  it('maps unavailable posts to NotFound and lets the moderation service inspect takedowns', async () => {
    const indexedAt = new Date('2026-01-02T00:00:00.000Z')
    const [uri, cid, record, action, seenAt] = await preparePost(
      sc.dids.alice,
      'taken down',
      indexedAt,
    )
    await network.bsky.sub.indexingSvc.indexRecord(
      uri,
      cid,
      record,
      action,
      seenAt,
    )

    const missingUri = AtUri.make(
      sc.dids.alice,
      app.bsky.feed.post.$type,
      TID.nextStr(),
    )
    const wrongCollection = AtUri.make(
      sc.dids.alice,
      app.bsky.feed.like.$type,
      TID.nextStr(),
    )
    for (const unavailable of [missingUri, wrongCollection]) {
      await expect(
        agent.app.bsky.feed.getPostVersions({ uri: unavailable.toString() }),
      ).rejects.toBeInstanceOf(AppBskyFeedGetPostVersions.NotFoundError)
    }

    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: uri.toString(),
      ref: 'post-versions-test',
    })
    try {
      await expect(
        agent.app.bsky.feed.getPostVersions(
          { uri: uri.toString() },
          {
            headers: await network.serviceHeaders(
              sc.dids.bob,
              ids.AppBskyFeedGetPostVersions,
            ),
          },
        ),
      ).rejects.toBeInstanceOf(AppBskyFeedGetPostVersions.NotFoundError)

      const privileged = await agent.app.bsky.feed.getPostVersions(
        { uri: uri.toString() },
        {
          headers: await network.serviceHeaders(
            network.bsky.ctx.cfg.modServiceDid,
            ids.AppBskyFeedGetPostVersions,
          ),
        },
      )
      expect(privileged.data.versions).toHaveLength(1)
      expect(privileged.data.versions[0]).toMatchObject({
        uri: uri.toString(),
        cid: cid.toString(),
        record: { text: 'taken down' },
      })
    } finally {
      await network.bsky.ctx.dataplane.untakedownRecord({
        recordUri: uri.toString(),
      })
    }
  })

  it('measures the edit window from the original indexing time', async () => {
    const indexedAt = new Date('2026-01-01T00:00:00.000Z')
    const created = await preparePost(sc.dids.alice, 'original', indexedAt)
    await network.bsky.sub.indexingSvc.indexRecord(...created)

    const [uri] = created
    const outOfOrder = post('stale', indexedAt.toISOString())
    await network.bsky.sub.indexingSvc.indexRecord(
      uri,
      await cidForCbor(outOfOrder),
      outOfOrder,
      WriteOpAction.Update,
      '2026-01-01T00:59:59+01:00',
    )
    expect(
      await network.bsky.ctx.dataplane.getPostVersions({
        uri: uri.toString(),
      }),
    ).toMatchObject({ versions: [{ cid: created[1].toString() }] })

    const expired = post('too late', indexedAt.toISOString())
    await expect(
      network.bsky.sub.indexingSvc.indexRecord(
        uri,
        await cidForCbor(expired),
        expired,
        WriteOpAction.Update,
        new Date(indexedAt.getTime() + 5 * 60_000 + 30_001).toISOString(),
      ),
    ).rejects.toMatchObject({ name: 'PostEditWindowError' })
    const { versions } = await network.bsky.ctx.dataplane.getPostVersions({
      uri: uri.toString(),
    })
    expect(versions).toHaveLength(1)
  })

  it('returns exact counts in request order, including duplicate refs', async () => {
    const db = network.bsky.db.db
    const subject = `at://${sc.dids.alice}/${app.bsky.feed.post.$type}/${TID.nextStr()}`
    const firstCid = (await cidForCbor({ version: 1 })).toString()
    const secondCid = (await cidForCbor({ version: 2 })).toString()
    const now = new Date().toISOString()

    await Promise.all([
      db
        .insertInto('like')
        .values({
          uri: `at://${sc.dids.bob}/app.bsky.feed.like/${TID.nextStr()}`,
          cid: (await cidForCbor({ kind: 'like' })).toString(),
          creator: sc.dids.bob,
          subject,
          subjectCid: firstCid,
          via: null,
          viaCid: null,
          createdAt: now,
          indexedAt: now,
        })
        .execute(),
      db
        .insertInto('repost')
        .values({
          uri: `at://${sc.dids.carol}/app.bsky.feed.repost/${TID.nextStr()}`,
          cid: (await cidForCbor({ kind: 'repost' })).toString(),
          creator: sc.dids.carol,
          subject,
          subjectCid: secondCid,
          via: null,
          viaCid: null,
          createdAt: now,
          indexedAt: now,
        })
        .execute(),
      db
        .insertInto('quote')
        .values({
          uri: `at://${sc.dids.carol}/${app.bsky.feed.post.$type}/${TID.nextStr()}`,
          cid: (await cidForCbor({ kind: 'quote' })).toString(),
          subject,
          subjectCid: firstCid,
          createdAt: now,
          indexedAt: now,
        })
        .execute(),
      db
        .insertInto('bookmark')
        .values({
          creator: sc.dids.bob,
          key: TID.nextStr(),
          subjectUri: subject,
          subjectCid: secondCid,
          indexedAt: now,
        })
        .execute(),
      db
        .insertInto('post')
        .values({
          uri: `at://${sc.dids.bob}/${app.bsky.feed.post.$type}/${TID.nextStr()}`,
          cid: (await cidForCbor({ kind: 'reply' })).toString(),
          creator: sc.dids.bob,
          text: 'reply',
          replyRoot: subject,
          replyRootCid: firstCid,
          replyParent: subject,
          replyParentCid: firstCid,
          langs: null,
          tags: null,
          createdAt: now,
          indexedAt: now,
        })
        .execute(),
    ])

    const refs = [
      { uri: subject, cid: firstCid },
      { uri: subject, cid: secondCid },
      { uri: subject, cid: firstCid },
      { uri: subject, cid: (await cidForCbor({ version: 3 })).toString() },
    ]
    const { counts } = await network.bsky.ctx.dataplane.getPostVersionCounts({
      refs,
    })
    expect(
      counts.map(({ likes, reposts, replies, quotes, bookmarks }) => ({
        likes,
        reposts,
        replies,
        quotes,
        bookmarks,
      })),
    ).toEqual([
      { likes: 1, reposts: 0, replies: 1, quotes: 1, bookmarks: 0 },
      { likes: 0, reposts: 1, replies: 0, quotes: 0, bookmarks: 1 },
      { likes: 1, reposts: 0, replies: 1, quotes: 1, bookmarks: 0 },
      { likes: 0, reposts: 0, replies: 0, quotes: 0, bookmarks: 0 },
    ])
    expect(counts.map((count) => count.ref)).toEqual(refs)
  })
})

function versionedPost(
  text: string,
  createdAt: string,
  labels: string[],
): AppBskyFeedPost.Record {
  return {
    $type: app.bsky.feed.post.$type,
    text,
    createdAt,
    embed: {
      $type: app.bsky.embed.external.$type,
      external: {
        uri: 'https://example.com/versioned-post',
        title: 'versioned post',
        description: 'versioned post description',
      },
    },
    labels: com.atproto.label.defs.selfLabels.$build({
      values: labels.map((val) => ({ val })),
    }),
  }
}

function post(text: string, createdAt: string): AppBskyFeedPost.Record {
  return {
    $type: app.bsky.feed.post.$type,
    text,
    createdAt,
  }
}

async function preparePost(
  did: string,
  text: string,
  timestamp: Date,
): Promise<[AtUri, Cid, AppBskyFeedPost.Record, WriteOpAction.Create, string]> {
  const record = post(text, timestamp.toISOString())
  return [
    AtUri.make(did, app.bsky.feed.post.$type, TID.nextStr()),
    await cidForCbor(record),
    record,
    WriteOpAction.Create,
    timestamp.toISOString(),
  ] satisfies Parameters<IndexingService['indexRecord']>
}
