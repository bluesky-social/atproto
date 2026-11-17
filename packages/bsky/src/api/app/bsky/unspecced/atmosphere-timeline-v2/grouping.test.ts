import { describe, expect, it } from 'vitest'
import { DAY, MINUTE as minute } from '@atproto/common'
import { type AtUriString, type DidString, atUri } from '@atproto/lex'
import { app, site, social } from '../../../../../lexicons/index.js'
import {
  type TimelineActivity,
  type TimelineHydration,
  groupAtmosphereActivities,
  referencedActors,
} from './grouping.js'

const timeline = app.bsky.unspecced.getAtmosphereTimelineV2
const cid = 'bafyreie5sviu7eeu3vf6n3lrlmqef2vdlwmgzd6zpolov56agdxtshdpda'
const now = Date.parse('2026-10-29T12:00:00.000Z')
const author = 'did:plc:author'
const doc = atUri(author, site.standard.document.$type, 'doc')
const gallery = atUri(author, social.grain.gallery.$type, 'gallery')

function activity(
  actor: DidString,
  collection: string,
  rkey: string,
  age: number,
  target?: AtUriString,
  groupable = true,
): TimelineActivity {
  const uri: AtUriString = `at://${actor}/${collection}/${rkey}`
  return {
    ref: { uri, cid },
    collection: collection as TimelineActivity['collection'],
    actor,
    sortedAt: now - age,
    subject: target ?? uri,
    creation: target === undefined,
    groupable,
  }
}

const recommend = (
  actor: DidString,
  rkey: string,
  age: number,
  target: AtUriString = doc,
) => activity(actor, site.standard.graph.recommend.$type, rkey, age, target)

const hydration: TimelineHydration = {
  subject: ({ subject }) =>
    timeline.activitySubject.$build({
      ref: { uri: subject, cid },
      view: app.bsky.embed.external.viewArticle.$build({
        uri: 'https://example.com/article',
        title: subject,
        description: '',
      }),
    }),
}

const group = (activities: TimelineActivity[]) =>
  groupAtmosphereActivities(activities, now, hydration)

describe('groupAtmosphereActivities', () => {
  it('attaches same-page activity to creations, which keep their own position', () => {
    const newer = activity(author, site.standard.document.$type, 'newer', 0)
    const recommendations = [
      recommend('did:plc:a', 'a', minute),
      recommend('did:plc:b', 'b', 2 * minute),
    ]
    const article = activity(author, site.standard.document.$type, 'doc', DAY)
    const favorite = activity(
      'did:plc:d',
      social.grain.favorite.$type,
      'fav',
      DAY + minute,
      gallery,
    )
    const galleryCreation = activity(
      author,
      social.grain.gallery.$type,
      'gallery',
      2 * DAY,
    )

    const feed = group([
      newer,
      ...recommendations,
      article,
      favorite,
      galleryCreation,
    ])

    expect(feed).toMatchObject([
      { $type: timeline.activityItem.$type, ref: newer.ref },
      {
        $type: timeline.activityItem.$type,
        ref: article.ref,
        indexedAt: new Date(article.sortedAt).toISOString(),
        actor: author,
        subject: { ref: { uri: doc } },
        relatedActivity: recommendations.map(({ ref, collection, actor }) => ({
          ref,
          collection,
          actor,
        })),
      },
      {
        $type: timeline.activityItem.$type,
        ref: galleryCreation.ref,
        relatedActivity: [{ ref: favorite.ref }],
      },
    ])
    expect(feed[0]).toMatchObject({ relatedActivity: undefined })
  })

  it('groups activity targeting an earlier-page subject by at least two actors', () => {
    const recommendations = [
      recommend('did:plc:a', 'a', 0),
      recommend('did:plc:b', 'b', DAY),
      recommend('did:plc:a', 'a2', 2 * DAY),
    ]
    const [single] = group([recommend('did:plc:a', 'only', 0)])

    expect(group(recommendations)).toMatchObject([
      {
        $type: timeline.activitySubjectGroup.$type,
        collection: site.standard.graph.recommend.$type,
        indexedAt: new Date(now).toISOString(),
        subject: { ref: { uri: doc } },
        activities: recommendations.map(({ ref, actor }) => ({ ref, actor })),
      },
    ])
    expect(single).toMatchObject({ $type: timeline.activityItem.$type })
  })

  it('actor-groups creations without related activity and actions by one actor', () => {
    const articles = [0, 1, 2].map((i) =>
      activity(author, site.standard.document.$type, `doc${i}`, i * minute),
    )
    const subscriptions = [0, 1].map((i) =>
      activity(
        'did:plc:reader',
        site.standard.graph.subscription.$type,
        `sub${i}`,
        (i + 5) * minute,
        atUri(author, site.standard.publication.$type, `pub${i}`),
      ),
    )
    const recommendations = [
      recommend('did:plc:reader', 'r1', 10 * minute),
      recommend('did:plc:reader', 'r2', 11 * minute),
    ]

    expect(
      group([...articles, ...subscriptions, ...recommendations]),
    ).toMatchObject([
      {
        $type: timeline.activityActorGroup.$type,
        actor: author,
        subjects: [{ ref: { uri: articles[0].ref.uri } }],
        activities: articles.map(({ ref }) => ({ ref, subject: ref.uri })),
      },
      {
        $type: timeline.activityActorGroup.$type,
        actor: 'did:plc:reader',
        collection: site.standard.graph.subscription.$type,
        subjects: [{ ref: { uri: subscriptions[0].subject } }],
        activities: subscriptions.map(({ ref, subject }) => ({ ref, subject })),
      },
      {
        $type: timeline.activityActorGroup.$type,
        collection: site.standard.graph.recommend.$type,
        activities: recommendations.map(({ ref }) => ({ ref, subject: doc })),
      },
    ])
  })

  it('leaves activity that may not be actor-grouped standalone', () => {
    const subscribedArticles = [0, 1].map((i) =>
      activity(
        author,
        site.standard.document.$type,
        `d${i}`,
        i,
        undefined,
        false,
      ),
    )

    expect(group(subscribedArticles)).toMatchObject(
      subscribedArticles.map(({ ref }) => ({
        $type: timeline.activityItem.$type,
        ref,
      })),
    )
  })
})

describe('referencedActors', () => {
  it('includes each header actor and the newest three actors per related collection or subject group', () => {
    const readers = ['a', 'b', 'c', 'd'].map(
      (name) => `did:plc:${name}` as DidString,
    )
    const feed = group([
      activity(author, site.standard.document.$type, 'doc', 0),
      ...readers.map((reader, i) => recommend(reader, `rec${i}`, i + 1)),
      ...readers.map((reader, i) =>
        // A hypothetical second collection targeting the article.
        activity(reader, 'com.example.mention', `mention${i}`, i + 10, doc),
      ),
      ...['e', 'e', 'f', 'g', 'h'].map((name, i) =>
        recommend(
          `did:plc:${name}`,
          `other${i}`,
          i + 20,
          atUri(author, site.standard.document.$type, 'earlier'),
        ),
      ),
    ])

    expect(feed.map(({ $type }) => $type)).toEqual([
      timeline.activityItem.$type,
      timeline.activitySubjectGroup.$type,
    ])
    expect(referencedActors(feed)).toEqual([
      author,
      ...readers.slice(0, 3),
      'did:plc:e',
      'did:plc:f',
      'did:plc:g',
    ])
  })
})
