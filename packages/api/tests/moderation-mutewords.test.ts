import type { $Typed } from '../src/client/util.js'
import {
  type AppBskyEmbedGallery,
  type AppBskyEmbedRecord,
  type AppBskyEmbedRecordWithMedia,
  type AppBskyFeedPost,
  BlobRef,
  RichText,
  mock,
  moderatePost,
} from '../src/index.js'
import { matchMuteWords } from '../src/moderation/mutewords.js'
import type { ModerationOpts } from '../src/moderation/types.js'

const FAKE_CID = 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq'

const fakeBlob = (): BlobRef =>
  new BlobRef({ '/': FAKE_CID } as any, 'image/jpeg', 1234)

const galleryRecord = (alts: string[]): $Typed<AppBskyEmbedGallery.Main> => ({
  $type: 'app.bsky.embed.gallery',
  items: alts.map(
    (alt): $Typed<AppBskyEmbedGallery.Image> => ({
      $type: 'app.bsky.embed.gallery#image',
      image: fakeBlob(),
      alt,
      aspectRatio: { width: 4, height: 3 },
    }),
  ),
})

const galleryView = (alts: string[]): $Typed<AppBskyEmbedGallery.View> => ({
  $type: 'app.bsky.embed.gallery#view',
  items: alts.map(
    (alt): $Typed<AppBskyEmbedGallery.ViewImage> => ({
      $type: 'app.bsky.embed.gallery#viewImage',
      thumbnail: 'https://example.test/thumb.jpg',
      fullsize: 'https://example.test/full.jpg',
      alt,
      aspectRatio: { width: 4, height: 3 },
    }),
  ),
})

const galleryMuteOpts = (): ModerationOpts => ({
  userDid: 'did:web:alice.test',
  prefs: {
    adultContentEnabled: false,
    labels: {},
    labelers: [],
    mutedWords: [
      { value: 'badword', targets: ['content'], actorTarget: 'all' },
    ],
    hiddenPosts: [],
  },
  labelDefs: {},
})

describe(`matchMuteWords`, () => {
  describe(`tags`, () => {
    it(`match: outline tag`, () => {
      const rt = new RichText({
        text: `This is a post #inlineTag`,
      })
      rt.detectFacetsWithoutResolution()

      const muteWord = {
        value: 'outlineTag',
        targets: ['tag'],
        actorTarget: 'all',
      }
      const match = matchMuteWords({
        mutedWords: [muteWord],
        text: rt.text,
        facets: rt.facets,
        outlineTags: ['outlineTag'],
      })

      expect(match).toEqual([{ word: muteWord, predicate: muteWord.value }])
    })

    it(`match: inline tag`, () => {
      const rt = new RichText({
        text: `This is a post #inlineTag`,
      })
      rt.detectFacetsWithoutResolution()

      const muteWord = {
        value: 'inlineTag',
        targets: ['tag'],
        actorTarget: 'all',
      }
      const match = matchMuteWords({
        mutedWords: [muteWord],
        text: rt.text,
        facets: rt.facets,
        outlineTags: ['outlineTag'],
      })

      expect(match).toEqual([{ word: muteWord, predicate: muteWord.value }])
    })

    it(`match: content target matches inline tag`, () => {
      const rt = new RichText({
        text: `This is a post #inlineTag`,
      })
      rt.detectFacetsWithoutResolution()

      const match = matchMuteWords({
        mutedWords: [
          { value: 'inlineTag', targets: ['content'], actorTarget: 'all' },
        ],
        text: rt.text,
        facets: rt.facets,
        outlineTags: ['outlineTag'],
      })

      expect(match).toBeTruthy()
    })

    it(`no match: only tag targets`, () => {
      const rt = new RichText({
        text: `This is a post`,
      })
      rt.detectFacetsWithoutResolution()

      const match = matchMuteWords({
        mutedWords: [
          { value: 'inlineTag', targets: ['tag'], actorTarget: 'all' },
        ],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toBeUndefined()
    })
  })

  describe(`early exits`, () => {
    it(`match: single character 希`, () => {
      /**
       * @see https://bsky.app/profile/mukuuji.bsky.social/post/3klji4fvsdk2c
       */
      const rt = new RichText({
        text: `改善希望です`,
      })
      rt.detectFacetsWithoutResolution()

      const muteWord = { value: '希', targets: ['content'], actorTarget: 'all' }
      const match = matchMuteWords({
        mutedWords: [muteWord],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toEqual([{ word: muteWord, predicate: muteWord.value }])
    })

    it(`match: single char with length > 1 ☠︎`, () => {
      const rt = new RichText({
        text: `Idk why ☠︎ but maybe`,
      })
      rt.detectFacetsWithoutResolution()

      const match = matchMuteWords({
        mutedWords: [
          { value: '☠︎', targets: ['content'], actorTarget: 'all' },
        ],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toBeTruthy()
    })

    it(`no match: long muted word, short post`, () => {
      const rt = new RichText({
        text: `hey`,
      })
      rt.detectFacetsWithoutResolution()

      const match = matchMuteWords({
        mutedWords: [
          { value: 'politics', targets: ['content'], actorTarget: 'all' },
        ],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toBeUndefined()
    })

    it(`match: exact text`, () => {
      const rt = new RichText({
        text: `javascript`,
      })
      rt.detectFacetsWithoutResolution()

      const match = matchMuteWords({
        mutedWords: [
          { value: 'javascript', targets: ['content'], actorTarget: 'all' },
        ],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toBeTruthy()
    })
  })

  describe(`general content`, () => {
    it(`match: word within post`, () => {
      const rt = new RichText({
        text: `This is a post about javascript`,
      })
      rt.detectFacetsWithoutResolution()

      const muteWord = {
        value: 'javascript',
        targets: ['content'],
        actorTarget: 'all',
      }
      const match = matchMuteWords({
        mutedWords: [muteWord],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toEqual([{ word: muteWord, predicate: muteWord.value }])
    })

    it(`no match: partial word`, () => {
      const rt = new RichText({
        text: `Use your brain, Eric`,
      })
      rt.detectFacetsWithoutResolution()

      const match = matchMuteWords({
        mutedWords: [{ value: 'ai', targets: ['content'], actorTarget: 'all' }],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toBeUndefined()
    })

    it(`match: multiline`, () => {
      const rt = new RichText({
        text: `Use your\n\tbrain, Eric`,
      })
      rt.detectFacetsWithoutResolution()

      const match = matchMuteWords({
        mutedWords: [
          { value: 'brain', targets: ['content'], actorTarget: 'all' },
        ],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toBeTruthy()
    })

    it(`match: :)`, () => {
      const rt = new RichText({
        text: `So happy :)`,
      })
      rt.detectFacetsWithoutResolution()

      const match = matchMuteWords({
        mutedWords: [{ value: `:)`, targets: ['content'], actorTarget: 'all' }],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toBeTruthy()
    })
  })

  describe(`punctuation semi-fuzzy`, () => {
    describe(`yay!`, () => {
      const rt = new RichText({
        text: `We're federating, yay!`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: yay!`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: 'yay!', targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: yay`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: 'yay', targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })

    describe(`y!ppee!!`, () => {
      const rt = new RichText({
        text: `We're federating, y!ppee!!`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: y!ppee`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: 'y!ppee', targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      // single exclamation point, source has double
      it(`no match: y!ppee!`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: 'y!ppee!', targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })

    describe(`apostrophes: Bluesky's`, () => {
      const rt = new RichText({
        text: `Yay, Bluesky's mutewords work`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: Bluesky's`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `Bluesky's`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: Bluesky`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: 'Bluesky', targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: bluesky`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: 'bluesky', targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: blueskys`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: 'blueskys', targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })

    describe(`Why so S@assy?`, () => {
      const rt = new RichText({
        text: `Why so S@assy?`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: S@assy`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: 'S@assy', targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: s@assy`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: 's@assy', targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })

    describe(`New York Times`, () => {
      const rt = new RichText({
        text: `New York Times`,
      })
      rt.detectFacetsWithoutResolution()

      // case insensitive
      it(`match: new york times`, () => {
        const match = matchMuteWords({
          mutedWords: [
            {
              value: 'new york times',
              targets: ['content'],
              actorTarget: 'all',
            },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })

    describe(`!command`, () => {
      const rt = new RichText({
        text: `Idk maybe a bot !command`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: !command`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `!command`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: command`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `command`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`no match: !command`, () => {
        const rt = new RichText({
          text: `Idk maybe a bot command`,
        })
        rt.detectFacetsWithoutResolution()

        const match = matchMuteWords({
          mutedWords: [
            { value: `!command`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeUndefined()
      })
    })

    describe(`and/or`, () => {
      const rt = new RichText({
        text: `Tomatoes are fruits and/or vegetables`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: and/or`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `and/or`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`no match: Andor`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `Andor`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeUndefined()
      })
    })

    describe(`super-bad`, () => {
      const rt = new RichText({
        text: `I'm super-bad`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: super-bad`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `super-bad`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: super`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `super`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: bad`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `bad`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: super bad`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `super bad`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: superbad`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `superbad`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })

    describe(`idk_what_this_would_be`, () => {
      const rt = new RichText({
        text: `Weird post with idk_what_this_would_be`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: idk what this would be`, () => {
        const match = matchMuteWords({
          mutedWords: [
            {
              value: `idk what this would be`,
              targets: ['content'],
              actorTarget: 'all',
            },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`no match: idk what this would be for`, () => {
        // extra word
        const match = matchMuteWords({
          mutedWords: [
            {
              value: `idk what this would be for`,
              targets: ['content'],
              actorTarget: 'all',
            },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeUndefined()
      })

      it(`match: idk`, () => {
        // extra word
        const match = matchMuteWords({
          mutedWords: [
            { value: `idk`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: idkwhatthiswouldbe`, () => {
        const match = matchMuteWords({
          mutedWords: [
            {
              value: `idkwhatthiswouldbe`,
              targets: ['content'],
              actorTarget: 'all',
            },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })

    describe(`parentheses`, () => {
      const rt = new RichText({
        text: `Post with context(iykyk)`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: context(iykyk)`, () => {
        const match = matchMuteWords({
          mutedWords: [
            {
              value: `context(iykyk)`,
              targets: ['content'],
              actorTarget: 'all',
            },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: context`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `context`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: iykyk`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `iykyk`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: (iykyk)`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `(iykyk)`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })

    describe(`🦋`, () => {
      const rt = new RichText({
        text: `Post with 🦋`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: 🦋`, () => {
        const match = matchMuteWords({
          mutedWords: [
            { value: `🦋`, targets: ['content'], actorTarget: 'all' },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })
  })

  describe(`phrases`, () => {
    describe(`I like turtles, or how I learned to stop worrying and love the internet.`, () => {
      const rt = new RichText({
        text: `I like turtles, or how I learned to stop worrying and love the internet.`,
      })
      rt.detectFacetsWithoutResolution()

      it(`match: stop worrying`, () => {
        const match = matchMuteWords({
          mutedWords: [
            {
              value: 'stop worrying',
              targets: ['content'],
              actorTarget: 'all',
            },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })

      it(`match: turtles, or how`, () => {
        const match = matchMuteWords({
          mutedWords: [
            {
              value: 'turtles, or how',
              targets: ['content'],
              actorTarget: 'all',
            },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
        })

        expect(match).toBeTruthy()
      })
    })
  })

  describe(`languages without spaces`, () => {
    // I love turtles, or how I learned to stop worrying and love the internet
    describe(`私はカメが好きです、またはどのようにして心配するのをやめてインターネットを愛するようになったのか`, () => {
      const rt = new RichText({
        text: `私はカメが好きです、またはどのようにして心配するのをやめてインターネットを愛するようになったのか`,
      })
      rt.detectFacetsWithoutResolution()

      // internet
      it(`match: インターネット`, () => {
        const match = matchMuteWords({
          mutedWords: [
            {
              value: 'インターネット',
              targets: ['content'],
              actorTarget: 'all',
            },
          ],
          text: rt.text,
          facets: rt.facets,
          outlineTags: [],
          languages: ['ja'],
        })

        expect(match).toBeTruthy()
      })
    })
  })

  describe(`facet with multiple features`, () => {
    it(`multiple tags`, () => {
      const match = matchMuteWords({
        mutedWords: [
          { value: 'bad', targets: ['content'], actorTarget: 'all' },
        ],
        text: 'tags',
        facets: [
          {
            features: [
              {
                $type: 'app.bsky.richtext.facet#tag',
                tag: 'good',
              },
              {
                $type: 'app.bsky.richtext.facet#tag',
                tag: 'bad',
              },
            ],
            index: {
              byteEnd: 4,
              byteStart: 0,
            },
          },
        ],
      })
      expect(match).toBeTruthy()
    })

    it(`other features`, () => {
      const match = matchMuteWords({
        mutedWords: [
          { value: 'bad', targets: ['content'], actorTarget: 'all' },
        ],
        text: 'test',
        facets: [
          {
            features: [
              {
                $type: 'com.example.richtext.facet#other',
                // @ts-expect-error
                foo: 'bar',
              },
              {
                $type: 'app.bsky.richtext.facet#tag',
                tag: 'bad',
              },
            ],
            index: {
              byteEnd: 4,
              byteStart: 0,
            },
          },
        ],
      })
      expect(match).toBeTruthy()
    })
  })

  describe(`doesn't mute own post`, () => {
    it(`does mute if it isn't own post`, () => {
      const res = moderatePost(
        mock.postView({
          record: mock.post({
            text: 'Mute words!',
          }),
          author: mock.profileViewBasic({
            handle: 'bob.test',
            displayName: 'Bob',
          }),
          labels: [],
        }),
        {
          userDid: 'did:web:alice.test',
          prefs: {
            adultContentEnabled: false,
            labels: {},
            labelers: [],
            mutedWords: [
              { value: 'words', targets: ['content'], actorTarget: 'all' },
            ],
            hiddenPosts: [],
          },
          labelDefs: {},
        },
      )
      expect(res.causes[0].type).toBe('mute-word')
    })

    it(`doesn't mute own post when muted word is in text`, () => {
      const res = moderatePost(
        mock.postView({
          record: mock.post({
            text: 'Mute words!',
          }),
          author: mock.profileViewBasic({
            handle: 'bob.test',
            displayName: 'Bob',
          }),
          labels: [],
        }),
        {
          userDid: 'did:web:bob.test',
          prefs: {
            adultContentEnabled: false,
            labels: {},
            labelers: [],
            mutedWords: [
              { value: 'words', targets: ['content'], actorTarget: 'all' },
            ],
            hiddenPosts: [],
          },
          labelDefs: {},
        },
      )
      expect(res.causes.length).toBe(0)
    })

    it(`doesn't mute own post when muted word is in tags`, () => {
      const rt = new RichText({
        text: `Mute #words!`,
      })
      const res = moderatePost(
        mock.postView({
          record: mock.post({
            text: rt.text,
            facets: rt.facets,
          }),
          author: mock.profileViewBasic({
            handle: 'bob.test',
            displayName: 'Bob',
          }),
          labels: [],
        }),
        {
          userDid: 'did:web:bob.test',
          prefs: {
            adultContentEnabled: false,
            labels: {},
            labelers: [],
            mutedWords: [
              { value: 'words', targets: ['tags'], actorTarget: 'all' },
            ],
            hiddenPosts: [],
          },
          labelDefs: {},
        },
      )
      expect(res.causes.length).toBe(0)
    })
  })

  describe(`timed mute words`, () => {
    it(`non-expired word`, () => {
      const now = Date.now()

      const res = moderatePost(
        mock.postView({
          record: mock.post({
            text: 'Mute words!',
          }),
          author: mock.profileViewBasic({
            handle: 'bob.test',
            displayName: 'Bob',
          }),
          labels: [],
        }),
        {
          userDid: 'did:web:alice.test',
          prefs: {
            adultContentEnabled: false,
            labels: {},
            labelers: [],
            mutedWords: [
              {
                value: 'words',
                targets: ['content'],
                expiresAt: new Date(now + 1e3).toISOString(),
                actorTarget: 'all',
              },
            ],
            hiddenPosts: [],
          },
          labelDefs: {},
        },
      )

      expect(res.causes[0].type).toBe('mute-word')
    })

    it(`expired word`, () => {
      const now = Date.now()

      const res = moderatePost(
        mock.postView({
          record: mock.post({
            text: 'Mute words!',
          }),
          author: mock.profileViewBasic({
            handle: 'bob.test',
            displayName: 'Bob',
          }),
          labels: [],
        }),
        {
          userDid: 'did:web:alice.test',
          prefs: {
            adultContentEnabled: false,
            labels: {},
            labelers: [],
            mutedWords: [
              {
                value: 'words',
                targets: ['content'],
                expiresAt: new Date(now - 1e3).toISOString(),
                actorTarget: 'all',
              },
            ],
            hiddenPosts: [],
          },
          labelDefs: {},
        },
      )

      expect(res.causes.length).toBe(0)
    })
  })

  describe(`actor-based mute words`, () => {
    const viewer = {
      userDid: 'did:web:alice.test',
      prefs: {
        adultContentEnabled: false,
        labels: {},
        labelers: [],
        mutedWords: [
          {
            value: 'words',
            targets: ['content'],
            actorTarget: 'exclude-following',
          },
        ],
        hiddenPosts: [],
      },
      labelDefs: {},
    }

    it(`followed actor`, () => {
      const res = moderatePost(
        mock.postView({
          record: mock.post({
            text: 'Mute words!',
          }),
          author: mock.profileViewBasic({
            handle: 'bob.test',
            displayName: 'Bob',
            viewer: {
              following: 'true',
            },
          }),
          labels: [],
        }),
        viewer,
      )
      expect(res.causes.length).toBe(0)
    })

    it(`non-followed actor`, () => {
      const res = moderatePost(
        mock.postView({
          record: mock.post({
            text: 'Mute words!',
          }),
          author: mock.profileViewBasic({
            handle: 'carla.test',
            displayName: 'Carla',
            viewer: {
              following: undefined,
            },
          }),
          labels: [],
        }),
        viewer,
      )
      expect(res.causes[0].type).toBe('mute-word')
    })
  })

  describe(`returning MuteWordMatch`, () => {
    it(`matches all`, () => {
      const rt = new RichText({
        text: `This is a post about javascript`,
      })
      rt.detectFacetsWithoutResolution()

      const muteWord1 = {
        value: 'post',
        targets: ['content'],
        actorTarget: 'all',
      }
      const muteWord2 = {
        value: 'javascript',
        targets: ['content'],
        actorTarget: 'all',
      }
      const match = matchMuteWords({
        mutedWords: [muteWord1, muteWord2],
        text: rt.text,
        facets: rt.facets,
        outlineTags: [],
      })

      expect(match).toEqual([
        { word: muteWord1, predicate: muteWord1.value },
        { word: muteWord2, predicate: muteWord2.value },
      ])
    })
  })

  describe(`gallery embed alt text`, () => {
    const bob = mock.profileViewBasic({
      handle: 'bob.test',
      displayName: 'Bob',
    })
    const carol = mock.profileViewBasic({
      handle: 'carol.test',
      displayName: 'Carol',
    })

    it(`matches alt text on a directly-attached gallery embed`, () => {
      const res = moderatePost(
        mock.postView({
          record: mock.post({
            text: 'innocent text',
            embed: galleryRecord(['fine', 'this contains badword here']),
          }),
          author: bob,
          labels: [],
        }),
        galleryMuteOpts(),
      )
      expect(res.causes.find((c) => c.type === 'mute-word')).toBeDefined()
    })

    it(`does not match when no item alt contains a muted word`, () => {
      const res = moderatePost(
        mock.postView({
          record: mock.post({
            text: 'innocent text',
            embed: galleryRecord(['nothing here', 'still nothing']),
          }),
          author: bob,
          labels: [],
        }),
        galleryMuteOpts(),
      )
      expect(res.causes.find((c) => c.type === 'mute-word')).toBeUndefined()
    })

    it(`matches alt text inside a quoted record's gallery`, () => {
      const quoted: AppBskyFeedPost.Record = mock.post({
        text: 'inside quoted',
        embed: galleryRecord(['contains badword inside']),
      })
      const res = moderatePost(
        mock.postView({
          record: mock.post({ text: 'outer post' }),
          embed: mock.embedRecordView({
            record: quoted,
            author: carol,
            labels: [],
          }),
          author: bob,
          labels: [],
        }),
        galleryMuteOpts(),
      )
      expect(res.causes.find((c) => c.type === 'mute-word')).toBeDefined()
    })

    it(`matches alt text on a quoted record's recordWithMedia gallery`, () => {
      const quotedRecord: AppBskyFeedPost.Record = mock.post({
        text: 'inside quoted record-with-media',
        embed: {
          $type: 'app.bsky.embed.recordWithMedia',
          record: {
            $type: 'app.bsky.embed.record',
            record: {
              uri: 'at://did:web:dave.test/app.bsky.feed.post/inner',
              cid: FAKE_CID,
            },
          } satisfies $Typed<AppBskyEmbedRecord.Main>,
          media: galleryRecord(['contains badword in nested gallery']),
        } satisfies $Typed<AppBskyEmbedRecordWithMedia.Main>,
      })
      const res = moderatePost(
        mock.postView({
          record: mock.post({ text: 'outer post' }),
          embed: mock.embedRecordView({
            record: quotedRecord,
            author: carol,
            labels: [],
          }),
          author: bob,
          labels: [],
        }),
        galleryMuteOpts(),
      )
      expect(res.causes.find((c) => c.type === 'mute-word')).toBeDefined()
    })

    it(`matches alt text on the view-side recordWithMedia gallery`, () => {
      const recordWithMediaView: $Typed<AppBskyEmbedRecordWithMedia.View> = {
        $type: 'app.bsky.embed.recordWithMedia#view',
        record: {
          $type: 'app.bsky.embed.record#view',
          record: {
            $type: 'app.bsky.embed.record#viewRecord',
            uri: 'at://did:web:dave.test/app.bsky.feed.post/inner',
            cid: FAKE_CID,
            author: carol,
            value: mock.post({ text: 'inner content' }),
            labels: [],
            indexedAt: new Date().toISOString(),
          },
        },
        media: galleryView(['contains badword on view side']),
      }
      const res = moderatePost(
        mock.postView({
          record: mock.post({ text: 'outer post' }),
          embed: recordWithMediaView,
          author: bob,
          labels: [],
        }),
        galleryMuteOpts(),
      )
      expect(res.causes.find((c) => c.type === 'mute-word')).toBeDefined()
    })
  })
})
