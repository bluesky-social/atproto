import { jest } from '@jest/globals'
import { ComAtprotoModerationDefs } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import type { AtUriString } from '@atproto/lex-schema'
import { readEnv } from '../src/config/env.js'
import { chat, com, tools } from '../src/lexicons/index.js'

describe('moderation subject content tagging', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    const env = jest.replaceProperty(process, 'env', {
      ...process.env,
      OZONE_LANGUAGE_TAG_RECORD_TYPES:
        '["app.bsky.*","site.standard.document"]',
    })
    const { languageTagRecordTypes } = readEnv()
    env.restore()
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_content_tagger_test',
      ozone: { languageTagRecordTypes },
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  const getStatus = async (subject: string) => {
    const { subjectStatuses } = await modClient.queryStatuses({
      subject,
    })

    return subjectStatuses[0]
  }

  describe('lang tagger', () => {
    it.each(['createReport', 'emitEvent'])(
      'skips language tags for conversation and message subjects via %s',
      async (endpoint) => {
        const convoId = `language-tag-convo-${endpoint}`
        const messageId = `language-tag-message-${endpoint}`
        const subjects = [
          {
            subject: chat.bsky.convo.defs.convoRef.$build({
              did: sc.dids.carol,
              convoId,
            }),
            uri: `at://${sc.dids.carol}/chat.bsky.convo/${convoId}`,
          },
          {
            subject: chat.bsky.convo.defs.messageRef.$build({
              did: sc.dids.carol,
              convoId,
              messageId,
            }),
            uri: `at://${sc.dids.carol}/chat.bsky.convo.message/${messageId}`,
          },
        ]

        for (const { subject, uri } of subjects) {
          if (endpoint === 'createReport') {
            await sc.createReport({
              reasonType: ComAtprotoModerationDefs.REASONSPAM,
              subject,
              reportedBy: sc.dids.alice,
            })
          } else {
            await modClient.emitEvent({
              subject,
              event: tools.ozone.moderation.defs.modEventReport.$build({
                reportType: com.atproto.moderation.defs.ReasonSpam,
              }),
            })
          }

          const { events } = await modClient.queryEvents({
            subject: uri,
            types: [tools.ozone.moderation.defs.modEventTag.$type],
          })
          expect(events).toHaveLength(1)
          expect(events[0].event).toMatchObject({ add: ['report:spam'] })

          await modClient.emitEvent({
            subject,
            event: tools.ozone.moderation.defs.modEventTag.$build({
              add: ['manual-tag'],
              remove: [],
            }),
          })
          const status = await getStatus(uri)
          expect(status.tags).toEqual(
            expect.arrayContaining(['report:spam', 'manual-tag']),
          )
          expect(status.tags?.filter((tag) => tag.startsWith('lang:'))).toEqual(
            [],
          )
        }
      },
    )

    it('tags only configured record types and preserves other subject tagging', async () => {
      const post = await sc.post(
        sc.dids.carol,
        '',
        undefined,
        sc.posts[sc.dids.carol][0].images,
      )
      const createRecord = async (collection: string) => {
        const { data } = await sc.agent.com.atproto.repo.createRecord(
          {
            repo: sc.dids.carol,
            collection,
            validate: false,
            record: { $type: collection, langs: ['fr'] },
          },
          { headers: sc.getHeaders(sc.dids.carol) },
        )
        return data
      }
      const document = await createRecord('site.standard.document')
      const excluded = await createRecord('app.bskyextra.feed.post')
      await network.processAll()

      const views = network.ozone.ctx.modService(network.ozone.ctx.db).views
      using fetchRecords = jest.spyOn(
        Object.getPrototypeOf(views) as typeof views,
        'fetchRecords',
      )
      await sc.createReport({
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: com.atproto.repo.strongRef.$build(post.ref.raw),
        reportedBy: sc.dids.alice,
      })
      const postReads = () =>
        fetchRecords.mock.calls.filter(([subjects]) =>
          subjects.some((subject) => subject.uri === post.ref.uriStr),
        ).length
      const initialReads = postReads()
      expect(initialReads).toBeGreaterThan(0)

      const event = tools.ozone.moderation.defs.modEventReport.$build({
        reportType: com.atproto.moderation.defs.ReasonSpam,
      })
      await modClient.emitEvent({
        subject: com.atproto.repo.strongRef.$build(post.ref.raw),
        event,
      })
      expect(postReads()).toBe(initialReads)
      await modClient.emitEvent({
        subject: com.atproto.repo.strongRef.$build({
          uri: document.uri as AtUriString,
          cid: document.cid,
        }),
        event,
      })
      await modClient.emitEvent({
        subject: com.atproto.repo.strongRef.$build({
          uri: excluded.uri as AtUriString,
          cid: excluded.cid,
        }),
        event,
      })
      await modClient.emitEvent({
        subject: com.atproto.admin.defs.repoRef.$build({ did: sc.dids.dan }),
        event,
      })

      expect((await getStatus(post.ref.uriStr)).tags).toEqual(
        expect.arrayContaining(['lang:und', 'embed:image', 'report:spam']),
      )
      expect((await getStatus(document.uri)).tags).toContain('lang:fr')
      expect((await getStatus(excluded.uri)).tags).toEqual(['report:spam'])
      expect((await getStatus(sc.dids.dan)).tags).toContain('lang:und')
    })

    it('Adds language tag to post from text', async () => {
      const createPostAndReport = async (text: string) => {
        const post = await sc.post(sc.dids.carol, text)
        await network.processAll()
        const report = await sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: post.ref.uriStr,
            cid: post.ref.cidStr,
          },
          reportedBy: sc.dids.alice,
        })

        return { post, report }
      }
      const [japanesePost, greekPost] = await Promise.all([
        createPostAndReport('Xで有名な人達＋反AIや絵描きによくない'),
        createPostAndReport(
          'Λορεμ ιπσθμ δολορ σιτ αμετ, μει θτ vιδιτ νοστρθμ προπριαε',
        ),
      ])

      const [japanesePostStatus, greekPostStatus] = await Promise.all([
        getStatus(japanesePost.post.ref.uriStr),
        getStatus(greekPost.post.ref.uriStr),
      ])

      expect(japanesePostStatus.tags).toContain('lang:ja')
      expect(greekPostStatus.tags).toContain('lang:el')
    })

    it('Uses name/description text for language tag for list', async () => {
      const createListAndReport = async (
        name: string,
        description?: string,
      ) => {
        const list = await sc.createList(sc.dids.carol, name, 'mod', {
          description,
        })
        await network.processAll()
        const report = await sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: list.uriStr,
            cid: list.cidStr,
          },
          reportedBy: sc.dids.alice,
        })
        return { list, report }
      }

      const [listWithDescription, listWithoutDescription] = await Promise.all([
        createListAndReport(
          'よくない',
          'Xで有名な人達＋反AIや絵描きによくない感情を持つ人達＋絵描き詐称',
        ),
        createListAndReport('人達＋反AIや絵描きによくない感情'),
      ])

      const [japaneseListStatus, chineseListStatus] = await Promise.all([
        getStatus(listWithDescription.list.uriStr),
        getStatus(listWithoutDescription.list.uriStr),
      ])

      expect(japaneseListStatus.tags).toContain('lang:ja')
      expect(chineseListStatus.tags).toContain('lang:ja')
    })
  })

  describe('embed tagger', () => {
    it('Adds image tag to post with image', async () => {
      const postWithImageMediaEmbed = sc.posts[sc.dids.carol][0]
      const postWithImageEmbed = sc.replies[sc.dids.bob][0]
      await Promise.all([
        sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postWithImageMediaEmbed.ref.uriStr,
            cid: postWithImageMediaEmbed.ref.cidStr,
          },
          reportedBy: sc.dids.alice,
        }),
        sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postWithImageEmbed.ref.uriStr,
            cid: postWithImageEmbed.ref.cidStr,
          },
          reportedBy: sc.dids.alice,
        }),
      ])

      const [mediaImagePostStatus, imagePostStatus] = await Promise.all([
        getStatus(postWithImageMediaEmbed.ref.uriStr),
        getStatus(postWithImageEmbed.ref.uriStr),
      ])
      expect(mediaImagePostStatus.tags).toContain('embed:image')
      expect(imagePostStatus.tags).toContain('embed:image')
    })
  })

  describe('report tagger', () => {
    it('Adds report reason tag by default', async () => {
      await Promise.all([
        sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
          reportedBy: sc.dids.alice,
        }),
        sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONMISLEADING,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
          reportedBy: sc.dids.alice,
        }),
      ])

      const accountStatus = await getStatus(sc.dids.carol)

      expect(accountStatus.tags).toContain('report:spam')
      expect(accountStatus.tags).toContain('report:misleading')
    })

    it('Adds report reason tags for moderator reports by default', async () => {
      await modClient.emitEvent({
        subject: com.atproto.admin.defs.repoRef.$build({
          did: sc.dids.alice,
        }),
        event: tools.ozone.moderation.defs.modEventReport.$build({
          reportType: com.atproto.moderation.defs.ReasonSpam,
        }),
      })

      const accountStatus = await getStatus(sc.dids.alice)
      expect(accountStatus.tags).toContain('report:spam')
    })

    it.each(['createReport', 'emitEvent'])(
      'Disables report tags through %s while preserving content and existing tags',
      async (endpoint) => {
        const service = network.ozone.ctx.cfg.service
        const original = service.reportTagsDisabled
        service.reportTagsDisabled = true

        try {
          const subject = com.atproto.admin.defs.repoRef.$build({
            did: sc.dids.bob,
          })
          await modClient.emitEvent({
            subject,
            event: tools.ozone.moderation.defs.modEventTag.$build({
              add: ['manual-tag', 'report:other'],
              remove: [],
            }),
          })
          const post = await sc.post(
            sc.dids.carol,
            'Xで有名な人達＋反AIや絵描きによくない',
            undefined,
            sc.posts[sc.dids.carol][0].images,
          )
          await network.processAll()

          const postSubject = com.atproto.repo.strongRef.$build({
            uri: post.ref.uriStr,
            cid: post.ref.cidStr,
          })
          if (endpoint === 'createReport') {
            await sc.createReport({
              reasonType: ComAtprotoModerationDefs.REASONSPAM,
              subject,
              reportedBy: sc.dids.alice,
            })
            await sc.createReport({
              reasonType: ComAtprotoModerationDefs.REASONMISLEADING,
              subject: postSubject,
              reportedBy: sc.dids.alice,
            })
          } else {
            await modClient.emitEvent({
              subject,
              event: tools.ozone.moderation.defs.modEventReport.$build({
                reportType: com.atproto.moderation.defs.ReasonSpam,
              }),
            })
            await modClient.emitEvent({
              subject: postSubject,
              event: tools.ozone.moderation.defs.modEventReport.$build({
                reportType: com.atproto.moderation.defs.ReasonMisleading,
              }),
            })
          }

          const accountStatus = await getStatus(sc.dids.bob)
          expect(accountStatus.tags).toEqual(
            expect.arrayContaining(['manual-tag', 'report:other']),
          )
          expect(accountStatus.tags).not.toContain('report:spam')

          const postStatus = await getStatus(post.ref.uriStr)
          expect(postStatus.tags).toEqual(
            expect.arrayContaining(['lang:ja', 'embed:image']),
          )
          expect(postStatus.tags).not.toContain('report:misleading')
        } finally {
          service.reportTagsDisabled = original
        }
      },
    )
  })
})
