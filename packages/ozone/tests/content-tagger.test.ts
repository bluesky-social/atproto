import { jest } from '@jest/globals'
import { ComAtprotoModerationDefs } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import type { AtUriString } from '@atproto/lex-schema'
import { com, tools } from '../src/lexicons/index.js'

describe('moderation subject content tagging', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_content_tagger_test',
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
      'avoids repeated self-profile lookups through %s when its language is unknown',
      async (endpoint) => {
        const account = await sc.createAccount(
          `profile-no-language-${endpoint}`,
          {
            handle:
              endpoint === 'createReport' ? 'profile-r.test' : 'profile-e.test',
            email: `profile-${endpoint}@empty.test`,
            password: 'hunter2',
          },
        )
        const profile = await sc.updateProfile(account.did, {
          $type: 'app.bsky.actor.profile',
        })
        await network.processAll()

        const ctx = network.ozone.ctx
        const service = ctx.cfg.service
        const original = service.languageTagRecordTypes
        const views = ctx.modService(ctx.db).views
        using fetchFeed = jest.spyOn(
          Object.getPrototypeOf(views) as typeof views,
          'fetchAuthorFeed',
        )
        using fetchRecords = jest.spyOn(
          Object.getPrototypeOf(views) as typeof views,
          'fetchRecords',
        )
        const subject = com.atproto.repo.strongRef.$build(profile.ref.raw)
        const report = async () => {
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
        }
        const feedCalls = () =>
          fetchFeed.mock.calls.filter(([did]) => did === account.did)
        const recordCalls = () =>
          fetchRecords.mock.calls.filter(([subjects]) =>
            subjects.some((item) => item.uri === profile.ref.uriStr),
          )

        try {
          service.languageTagRecordTypes = ['app.bsky.feed.post']
          await report()
          expect((await getStatus(profile.ref.uriStr)).tags).not.toContain(
            'lang:und',
          )
          expect(feedCalls()).toHaveLength(0)
          expect(recordCalls()).toHaveLength(0)

          service.languageTagRecordTypes = ['app.bsky.*']
          await report()
          await report()
          expect((await getStatus(profile.ref.uriStr)).tags).toContain(
            'lang:und',
          )
          expect(feedCalls()).toHaveLength(1)
          expect(recordCalls()).toHaveLength(1)
          const { events } = await modClient.queryEvents({
            subject: profile.ref.uriStr,
            addedTags: ['lang:und'],
          })
          expect(events).toHaveLength(1)
        } finally {
          service.languageTagRecordTypes = original
        }
      },
    )

    it('uses known languages from the self-profile and author feed', async () => {
      const account = await sc.createAccount('profile-languages', {
        handle: 'profile-langs.test',
        email: 'profile-langs@test.example',
        password: 'hunter2',
      })
      const profile = await sc.updateProfile(account.did, {
        $type: 'app.bsky.actor.profile',
        description: 'Xで有名な人達＋反AIや絵描きによくない',
      })
      await sc.post(
        account.did,
        'A post in English',
        undefined,
        undefined,
        undefined,
        {
          langs: ['en-US'],
        },
      )
      await network.processAll()
      await sc.createReport({
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: com.atproto.repo.strongRef.$build(profile.ref.raw),
        reportedBy: sc.dids.alice,
      })

      const tags = (await getStatus(profile.ref.uriStr)).tags
      expect(tags).toEqual(expect.arrayContaining(['lang:en', 'lang:ja']))
      expect(tags).not.toContain('lang:und')
    })

    it.each(['createReport', 'emitEvent'])(
      'uses an undetermined account tag to avoid repeated feed lookups through %s',
      async (endpoint) => {
        const account = await sc.createAccount(`no-language-${endpoint}`, {
          handle:
            endpoint === 'createReport'
              ? 'empty-report.test'
              : 'empty-event.test',
          email: `${endpoint}@empty.test`,
          password: 'hunter2',
        })
        await network.processAll()

        const ctx = network.ozone.ctx
        const views = ctx.modService(ctx.db).views
        using fetchFeed = jest.spyOn(
          Object.getPrototypeOf(views) as typeof views,
          'fetchAuthorFeed',
        )
        const subject = com.atproto.admin.defs.repoRef.$build({
          did: account.did,
        })
        const report = async () => {
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
        }

        await report()
        await report()
        expect((await getStatus(account.did)).tags).toContain('lang:und')
        expect(
          fetchFeed.mock.calls.filter(([did]) => did === account.did),
        ).toHaveLength(1)
        const { events } = await modClient.queryEvents({
          subject: account.did,
          addedTags: ['lang:und'],
        })
        expect(events).toHaveLength(1)
      },
    )

    it('preserves declared undetermined and known account languages', async () => {
      const unknown = await sc.createAccount('unknown-language', {
        handle: 'unknown-language.test',
        email: 'unknown-language@test.example',
        password: 'hunter2',
      })
      const mixed = await sc.createAccount('mixed-language', {
        handle: 'mixed-language.test',
        email: 'mixed-language@test.example',
        password: 'hunter2',
      })
      await sc.post(unknown.did, '', undefined, undefined, undefined, {
        langs: ['und-Latn'],
      })
      await sc.post(mixed.did, '', undefined, undefined, undefined, {
        langs: ['und', 'en-US'],
      })
      await network.processAll()

      for (const account of [unknown, mixed]) {
        await sc.createReport({
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
          subject: com.atproto.admin.defs.repoRef.$build({ did: account.did }),
          reportedBy: sc.dids.alice,
        })
      }

      expect((await getStatus(unknown.did)).tags).toContain('lang:und')
      const mixedTags = (await getStatus(mixed.did)).tags
      expect(mixedTags).toContain('lang:en')
      expect(mixedTags).toContain('lang:und')
    })

    it.each(['createReport', 'emitEvent'])(
      'filters record language tags through %s',
      async (endpoint) => {
        const service = network.ozone.ctx.cfg.service
        const original = service.languageTagRecordTypes
        try {
          const report = async (uri: AtUriString, cid: string) => {
            const subject = com.atproto.repo.strongRef.$build({ uri, cid })
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
            return getStatus(uri)
          }

          const post = await sc.post(
            sc.dids.carol,
            'Xで有名な人達＋反AIや絵描きによくない',
            undefined,
            sc.posts[sc.dids.carol][0].images,
          )
          const list = await sc.createList(
            sc.dids.carol,
            '人達＋反AIや絵描きによくない感情',
            'mod',
          )
          const other = await sc.agent.com.atproto.repo.createRecord(
            {
              repo: sc.dids.carol,
              collection: 'app.bskyextra.feed.post',
              validate: false,
              record: { $type: 'app.bskyextra.feed.post', langs: ['ja'] },
            },
            { headers: sc.getHeaders(sc.dids.carol) },
          )
          const standard = await sc.agent.com.atproto.repo.createRecord(
            {
              repo: sc.dids.carol,
              collection: 'site.standard.document',
              validate: false,
              record: { $type: 'site.standard.document', langs: ['fr'] },
            },
            { headers: sc.getHeaders(sc.dids.carol) },
          )
          await network.processAll()

          service.languageTagRecordTypes = [
            'app.bsky.*',
            'site.standard.document',
          ]
          expect((await report(list.uriStr, list.cidStr)).tags).toContain(
            'lang:ja',
          )
          expect(
            (await report(standard.data.uri as AtUriString, standard.data.cid))
              .tags,
          ).toContain('lang:fr')
          const otherStatus = await report(
            other.data.uri as AtUriString,
            other.data.cid,
          )
          expect(otherStatus.tags?.some((tag) => tag.startsWith('lang:'))).toBe(
            false,
          )
          expect(otherStatus.tags).toContain('report:spam')

          service.languageTagRecordTypes = []
          const postStatus = await report(post.ref.uriStr, post.ref.cidStr)
          expect(postStatus.tags?.some((tag) => tag.startsWith('lang:'))).toBe(
            false,
          )
          expect(postStatus.tags).toEqual(
            expect.arrayContaining(['report:spam', 'embed:image']),
          )
          await modClient.emitEvent({
            subject: com.atproto.repo.strongRef.$build({
              uri: post.ref.uriStr,
              cid: post.ref.cidStr,
            }),
            event: tools.ozone.moderation.defs.modEventTag.$build({
              add: ['lang:und'],
              remove: [],
            }),
          })
          expect(
            (await report(post.ref.uriStr, post.ref.cidStr)).tags,
          ).toContain('lang:und')

          const accountDid =
            endpoint === 'createReport' ? sc.dids.alice : sc.dids.carol
          await sc.post(
            accountDid,
            'A post in English',
            undefined,
            undefined,
            undefined,
            {
              langs: ['en'],
            },
          )
          await network.processAll()
          const accountSubject = com.atproto.admin.defs.repoRef.$build({
            did: accountDid,
          })
          if (endpoint === 'createReport') {
            await sc.createReport({
              reasonType: ComAtprotoModerationDefs.REASONSPAM,
              subject: accountSubject,
              reportedBy: sc.dids.bob,
            })
          } else {
            await modClient.emitEvent({
              subject: accountSubject,
              event: tools.ozone.moderation.defs.modEventReport.$build({
                reportType: com.atproto.moderation.defs.ReasonSpam,
              }),
            })
          }
          expect((await getStatus(accountDid)).tags).toContain('lang:en')

          service.languageTagRecordTypes = [
            'app.bsky.graph.*',
            'app.bsky.feed.post',
          ]
          const allowedList = await sc.createList(
            sc.dids.carol,
            '人達＋反AIや絵描きによくない感情',
            'mod',
          )
          const allowedPost = await sc.post(
            sc.dids.carol,
            'Xで有名な人達＋反AIや絵描きによくない',
          )
          await network.processAll()
          expect(
            (await report(allowedList.uriStr, allowedList.cidStr)).tags,
          ).toContain('lang:ja')
          expect(
            (await report(allowedPost.ref.uriStr, allowedPost.ref.cidStr)).tags,
          ).toContain('lang:ja')
        } finally {
          service.languageTagRecordTypes = original
        }
      },
    )

    it.each(['createReport', 'emitEvent'])(
      'tags undetermined records once through %s',
      async (endpoint) => {
        const unspecified = await sc.post(
          sc.dids.carol,
          '',
          undefined,
          sc.posts[sc.dids.carol][0].images,
        )
        const undetermined = await sc.post(
          sc.dids.carol,
          '',
          undefined,
          undefined,
          undefined,
          { langs: ['und-Latn'] },
        )
        const mixed = await sc.post(
          sc.dids.carol,
          '',
          undefined,
          undefined,
          undefined,
          { langs: ['und', 'en-US'] },
        )
        await network.processAll()

        const ctx = network.ozone.ctx
        const views = ctx.modService(ctx.db).views
        using fetchRecords = jest.spyOn(
          Object.getPrototypeOf(views) as typeof views,
          'fetchRecords',
        )
        const report = async (post: typeof unspecified) => {
          const subject = com.atproto.repo.strongRef.$build({
            uri: post.ref.uriStr,
            cid: post.ref.cidStr,
          })
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
        }
        await report(unspecified)
        const readsAfterFirstReport = fetchRecords.mock.calls.filter(
          ([subjects]) =>
            subjects.some((item) => item.uri === unspecified.ref.uriStr),
        ).length
        expect(readsAfterFirstReport).toBeGreaterThan(0)
        await report(unspecified)
        expect(
          fetchRecords.mock.calls.filter(([subjects]) =>
            subjects.some((item) => item.uri === unspecified.ref.uriStr),
          ),
        ).toHaveLength(readsAfterFirstReport)
        await report(undetermined)
        await report(mixed)

        expect((await getStatus(unspecified.ref.uriStr)).tags).toEqual(
          expect.arrayContaining(['report:spam', 'embed:image', 'lang:und']),
        )
        expect((await getStatus(undetermined.ref.uriStr)).tags).toContain(
          'lang:und',
        )
        expect((await getStatus(mixed.ref.uriStr)).tags).toContain('lang:en')
        expect((await getStatus(mixed.ref.uriStr)).tags).toContain('lang:und')
      },
    )

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
