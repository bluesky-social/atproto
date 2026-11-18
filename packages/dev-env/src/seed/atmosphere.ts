import { readFile } from 'node:fs/promises'
import { type AtpAgent, COM_ATPROTO_MODERATION } from '@atproto/api'
import type { TestNetwork } from '../network.js'

export type AtmosphereFixture = {
  title: string
  collection: string
  uri: string
  cid: string
  eventId?: number
  reportId?: number
  queueId?: number
}

export type AtmosphereSeed = {
  records: AtmosphereFixture[]
  queues: Record<string, number>
}

/** Seed synthetic third-party records, their dependencies, and queued Ozone reports. */
export async function seedAtmosphere(
  network: TestNetwork,
  agents: {
    author: AtpAgent
    photographer: AtpAgent
    streamer: AtpAgent
    reporter: AtpAgent
  },
): Promise<AtmosphereSeed> {
  const { author, photographer, streamer, reporter } = agents
  const records: AtmosphereFixture[] = []
  const now = new Date().toISOString()
  const yesterday = new Date(Date.now() - 86_400_000).toISOString()
  const photos: [number, string, string, number, number, string][] = [
    [
      0,
      'Landscape photograph',
      'key-landscape-small.jpg',
      150,
      87,
      'A key in a landscape image.',
    ],
    [
      1,
      'Portrait photograph',
      'key-portrait-small.jpg',
      87,
      150,
      'A key in a portrait image.',
    ],
    [2, 'Photo without alt text', 'key-alt.jpg', 400, 400, ''],
  ]
  const put = async (
    agent: AtpAgent,
    collection: string,
    value: Record<string, unknown>,
    title: string,
    report = true,
  ) => {
    const record = { $type: collection, ...value }
    const { data } = await agent.com.atproto.repo.createRecord({
      repo: agent.assertDid,
      collection,
      record,
    })
    const saved = { uri: data.uri, cid: data.cid, value: record }
    if (report)
      records.push({ title, collection, uri: data.uri, cid: data.cid })
    return saved
  }
  const picture = async (agent: AtpAgent, filename: string) => {
    const image = await readFile(
      new URL(`../../assets/${filename}`, import.meta.url),
    )
    const { data } = await agent.com.atproto.repo.uploadBlob(image, {
      encoding: 'image/jpeg',
    })
    return data.blob
  }
  const cover = await picture(author, 'key-landscape-small.jpg')
  const icon = await picture(author, 'key-alt.jpg')
  const publication = await put(
    author,
    'site.standard.publication',
    {
      name: 'Local journal — publication with icon',
      url: 'https://journal.example.test',
      description:
        'A local Standard publication for reviewing article and publication cards.',
      icon,
      preferences: { showInDiscover: true },
      basicTheme: {
        $type: 'site.standard.theme.basic',
        background: {
          $type: 'site.standard.theme.color#rgb',
          r: 240,
          g: 249,
          b: 255,
        },
        foreground: {
          $type: 'site.standard.theme.color#rgb',
          r: 15,
          g: 23,
          b: 42,
        },
        accent: {
          $type: 'site.standard.theme.color#rgb',
          r: 37,
          g: 99,
          b: 235,
        },
        accentForeground: {
          $type: 'site.standard.theme.color#rgb',
          r: 255,
          g: 255,
          b: 255,
        },
      },
    },
    'Publication with icon and description',
  )
  await put(
    author,
    'site.standard.publication',
    { name: 'Minimal publication', url: 'https://minimal.example.test' },
    'Minimal publication',
  )
  const post = await put(
    author,
    'app.bsky.feed.post',
    {
      text: 'A new article from the Local journal. This post is linked from a Standard document fixture.',
      createdAt: now,
    },
    'Article announcement post',
    false,
  )
  const article = await put(
    author,
    'site.standard.document',
    {
      site: publication.uri,
      path: '/articles/complete-example',
      title: 'Complete article with publication and linked post',
      description:
        'Check the cover image, publication link, tags, timestamps, and linked Bluesky post.',
      textContent:
        'This article lives on the local PDS.\n\nThe publication and the linked post are real local records. You can inspect both the simple record and the AppView context.\n\nAll content is synthetic test data.',
      publishedAt: yesterday,
      updatedAt: now,
      coverImage: cover,
      tags: ['local', 'article', 'moderation'],
      bskyPostRef: { uri: post.uri, cid: post.cid },
    },
    'Complete article',
  )
  await put(
    author,
    'site.standard.document',
    {
      site: 'https://independent.example.test',
      path: '/standalone',
      title: 'Standalone article with HTTPS site',
      publishedAt: now,
      description: 'No publication record is needed for this document.',
      textContent:
        'A standalone article whose source URL is formed directly from its HTTPS site and path.',
    },
    'Standalone HTTPS article',
  )
  await put(
    author,
    'site.standard.document',
    {
      site: publication.uri,
      path: '/structured',
      title: 'Structured article without plain text',
      publishedAt: now,
      description:
        'Exercises the missing plaintext message and raw record view.',
      content: {
        $type: 'com.example.article.content',
        blocks: [
          {
            type: 'paragraph',
            text: 'Structured-only content is visible in the raw record.',
          },
        ],
      },
    },
    'Structured-only article',
  )
  await put(
    author,
    'site.standard.document',
    {
      site: `at://${author.assertDid}/site.standard.publication/2222222222222`,
      path: '/missing-publication',
      title: 'Article with unavailable publication',
      publishedAt: now,
      textContent:
        'The document exists, but its referenced publication does not. The simple record should remain usable.',
    },
    'Unavailable-publication article',
  )
  await put(
    author,
    'site.standard.document',
    {
      site: publication.uri,
      path: '/long-read',
      title: 'Long article — scrolling and multiline text',
      publishedAt: now,
      description: 'An article with enough text to exercise bounded scrolling.',
      textContent: Array.from(
        { length: 32 },
        (_, i) =>
          `Paragraph ${i + 1}: This is synthetic local content for reviewing article cards, text wrapping, scrolling, and moderation details. The record is stored on the development PDS.`,
      ).join('\n\n'),
      coverImage: cover,
      tags: ['longread', 'local'],
    },
    'Long article',
  )
  await put(
    author,
    'site.standard.document',
    { site: publication.uri, title: 'Minimal article', publishedAt: now },
    'Minimal article',
  )

  const gallery = await put(
    photographer,
    'social.grain.gallery',
    {
      title: 'Local gallery — three photos',
      description:
        'Three local photos with landscape, portrait, and missing-alt cases.',
      createdAt: now,
    },
    'Gallery with three photos',
  )
  await put(
    photographer,
    'social.grain.gallery',
    { title: 'Empty local gallery', createdAt: now },
    'Empty gallery',
  )
  for (const [position, title, filename, width, height, alt] of photos) {
    const photo = await put(
      photographer,
      'social.grain.photo',
      {
        photo: await picture(photographer, filename),
        alt: alt ?? '',
        aspectRatio: { width, height },
        createdAt: now,
      },
      title,
    )
    await put(
      photographer,
      'social.grain.gallery.item',
      { gallery: gallery.uri, item: photo.uri, position, createdAt: now },
      'Gallery item',
      false,
    )
  }
  const streamPost = await put(
    streamer,
    'app.bsky.feed.post',
    {
      text: 'Announcing a synthetic local livestream for Ozone frontend testing.',
      createdAt: now,
    },
    'Livestream announcement',
    false,
  )
  const thumb = await picture(streamer, 'key-landscape-small.jpg')
  await put(
    streamer,
    'place.stream.livestream',
    {
      title: 'Local livestream with thumbnail and announcement',
      createdAt: now,
      lastSeenAt: now,
      canonicalUrl: 'https://stream.example.test/watch/local',
      url: 'https://stream.example.test/replicate/local',
      thumb,
      agent: 'LocalFixture/1.0',
      tags: ['local', 'lang:en'],
      post: { uri: streamPost.uri, cid: streamPost.cid },
    },
    'Livestream with announcement',
  )
  await put(
    streamer,
    'place.stream.livestream',
    {
      title: 'Ended local livestream',
      createdAt: yesterday,
      endedAt: now,
      canonicalUrl: 'https://stream.example.test/watch/ended',
    },
    'Ended livestream',
  )
  await put(
    author,
    'com.example.note',
    {
      title: 'Unknown record collection',
      text: 'This record exercises the generic JSON fallback.',
      createdAt: now,
    },
    'Generic record fallback',
  )

  await put(
    reporter,
    'site.standard.graph.recommend',
    { document: article.uri, createdAt: now },
    'Article recommendation',
    false,
  )
  await put(
    reporter,
    'site.standard.graph.subscription',
    { publication: publication.uri, createdAt: now },
    'Publication subscription',
    false,
  )
  await put(
    reporter,
    'social.grain.favorite',
    { subject: gallery.uri, createdAt: now },
    'Gallery favorite',
    false,
  )
  await network.processAll()
  const ozone = network.ozone.getAgent()
  const queues: Record<string, number> = {}
  for (const collection of new Set(
    records.map((record) => record.collection),
  )) {
    const { data } = await ozone.tools.ozone.queue.createQueue(
      {
        name: `Atmosphere: ${collection}`,
        subjectTypes: ['record'],
        reportTypes: [COM_ATPROTO_MODERATION.DefsReasonOther],
        collection,
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          'tools.ozone.queue.createQueue',
          'admin',
        ),
      },
    )
    queues[collection] = data.queue.id
  }
  for (const record of records) {
    const { data } = await reporter.com.atproto.moderation.createReport({
      reasonType: COM_ATPROTO_MODERATION.DefsReasonOther,
      reason: `Local frontend test: ${record.title}. Synthetic content for reviewing ${record.collection} rendering.`,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: record.uri,
        cid: record.cid,
      },
    })
    record.eventId = data.id
  }
  await network.ozone.daemon.ctx.queueRouter.routeReports()
  const { data } = await ozone.tools.ozone.report.queryReports(
    { status: 'queued', limit: 100 },
    {
      headers: await network.ozone.modHeaders(
        'tools.ozone.report.queryReports',
        'admin',
      ),
    },
  )
  for (const record of records) {
    const report = data.reports.find(
      (report) => report.eventId === record.eventId,
    )
    if (!report)
      throw new Error(`Fixture report was not queued: ${record.title}`)
    record.reportId = report.id
    record.queueId = queues[record.collection]
  }
  return { records, queues }
}
