import { beforeEach, describe, expect, it } from 'vitest'
import { preferencesStore } from './_xrpc-fetch.test.js'
import type { Agent } from './agent.js'
import type { AppBskyActorDefs } from './client/index.js'

describe('Agent muted words', () => {
  describe('muted words', () => {
    let agent: Agent

    beforeEach(() => {
      agent = preferencesStore().agent
    })

    describe('addMutedWord', () => {
      it('inserts', async () => {
        const expiresAt = new Date(Date.now() + 6e3).toISOString()
        await agent.addMutedWord({
          value: 'word',
          targets: ['content'],
          actorTarget: 'all',
          expiresAt,
        })

        const { moderationPrefs } = await agent.getPreferences()
        const word = moderationPrefs.mutedWords.find((m) => m.value === 'word')

        expect(word!.id).toBeTruthy()
        expect(word!.targets).toEqual(['content'])
        expect(word!.actorTarget).toEqual('all')
        expect(word!.expiresAt).toEqual(expiresAt)
      })

      it('single-hash #, no insert', async () => {
        await agent.addMutedWord({
          value: '#',
          targets: [],
          actorTarget: 'all',
        })
        const { moderationPrefs } = await agent.getPreferences()

        // sanitized to empty string, not inserted
        expect(moderationPrefs.mutedWords.length).toEqual(0)
      })

      it('multi-hash ##, inserts #', async () => {
        await agent.addMutedWord({
          value: '##',
          targets: [],
          actorTarget: 'all',
        })
        const { moderationPrefs } = await agent.getPreferences()
        expect(
          moderationPrefs.mutedWords.find((m) => m.value === '#'),
        ).toBeTruthy()
      })

      it('multi-hash ##hashtag, inserts #hashtag', async () => {
        await agent.addMutedWord({
          value: '##hashtag',
          targets: [],
          actorTarget: 'all',
        })
        const { moderationPrefs } = await agent.getPreferences()
        expect(
          moderationPrefs.mutedWords.find((w) => w.value === '#hashtag'),
        ).toBeTruthy()
      })

      it('hash emoji #️⃣, inserts #️⃣', async () => {
        await agent.addMutedWord({
          value: '#️⃣',
          targets: [],
          actorTarget: 'all',
        })
        const { moderationPrefs } = await agent.getPreferences()
        expect(
          moderationPrefs.mutedWords.find((m) => m.value === '#️⃣'),
        ).toBeTruthy()
      })

      it('hash emoji w/leading hash ##️⃣, inserts #️⃣', async () => {
        await agent.addMutedWord({
          value: '##️⃣',
          targets: [],
          actorTarget: 'all',
        })
        const { moderationPrefs } = await agent.getPreferences()
        expect(
          moderationPrefs.mutedWords.find((m) => m.value === '#️⃣'),
        ).toBeTruthy()
      })

      it('hash emoji with double leading hash ###️⃣, inserts ##️⃣', async () => {
        await agent.addMutedWord({
          value: '###️⃣',
          targets: [],
          actorTarget: 'all',
        })
        const { moderationPrefs } = await agent.getPreferences()
        expect(
          moderationPrefs.mutedWords.find((m) => m.value === '##️⃣'),
        ).toBeTruthy()
      })

      it(`includes apostrophes e.g. Bluesky's`, async () => {
        await agent.addMutedWord({
          value: `Bluesky's`,
          targets: [],
          actorTarget: 'all',
        })
        const { mutedWords } = (await agent.getPreferences()).moderationPrefs

        expect(mutedWords.find((m) => m.value === `Bluesky's`)).toBeTruthy()
      })

      describe(`invalid characters`, () => {
        it('#<zws>, no insert', async () => {
          await agent.addMutedWord({
            value: '#​',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.length).toEqual(0)
        })

        it('#<zws>ab, inserts ab', async () => {
          await agent.addMutedWord({
            value: '#​ab',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.length).toEqual(1)
        })

        it('phrase with newline, inserts phrase without newline', async () => {
          await agent.addMutedWord({
            value: 'test value\n with newline',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(
            moderationPrefs.mutedWords.find(
              (m) => m.value === 'test value with newline',
            ),
          ).toBeTruthy()
        })

        it('phrase with newlines, inserts phrase without newlines', async () => {
          await agent.addMutedWord({
            value: 'test value\n\r with newline',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(
            moderationPrefs.mutedWords.find(
              (m) => m.value === 'test value with newline',
            ),
          ).toBeTruthy()
        })

        it('empty space, no insert', async () => {
          await agent.addMutedWord({
            value: ' ',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.length).toEqual(0)
        })

        it(`' trim ', inserts 'trim'`, async () => {
          await agent.addMutedWord({
            value: ' trim ',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(
            moderationPrefs.mutedWords.find((m) => m.value === 'trim'),
          ).toBeTruthy()
        })
      })
    })

    describe('addMutedWords', () => {
      it('inserts happen sequentially, no clobbering', async () => {
        await agent.addMutedWords([
          { value: 'a', targets: ['content'], actorTarget: 'all' },
          { value: 'b', targets: ['content'], actorTarget: 'all' },
          { value: 'c', targets: ['content'], actorTarget: 'all' },
        ])

        const { moderationPrefs } = await agent.getPreferences()

        expect(moderationPrefs.mutedWords.length).toEqual(3)
      })
    })

    describe('upsertMutedWords (deprecated)', () => {
      it('no longer upserts, calls addMutedWords', async () => {
        await agent.upsertMutedWords([
          { value: 'both', targets: ['content'], actorTarget: 'all' },
        ])
        await agent.upsertMutedWords([
          { value: 'both', targets: ['tag'], actorTarget: 'all' },
        ])

        const { moderationPrefs } = await agent.getPreferences()

        expect(moderationPrefs.mutedWords.length).toEqual(2)
      })
    })

    describe('updateMutedWord', () => {
      it(`word doesn't exist, no update or insert`, async () => {
        await agent.updateMutedWord({
          value: 'word',
          targets: ['tag', 'content'],
          actorTarget: 'all',
        })
        const { moderationPrefs } = await agent.getPreferences()
        expect(moderationPrefs.mutedWords.length).toEqual(0)
      })

      it('updates and sanitizes new value', async () => {
        await agent.addMutedWord({
          value: 'value',
          targets: ['content'],
          actorTarget: 'all',
        })

        const a = await agent.getPreferences()
        const word = a.moderationPrefs.mutedWords.find(
          (m) => m.value === 'value',
        )

        await agent.updateMutedWord({
          ...word!,
          value: '#new value',
        })

        const b = await agent.getPreferences()
        const updatedWord = b.moderationPrefs.mutedWords.find(
          (m) => m.id === word!.id,
        )

        expect(updatedWord!.value).toEqual('new value')
        expect(updatedWord).toHaveProperty('targets', ['content'])
      })

      it('updates targets', async () => {
        await agent.addMutedWord({
          value: 'word',
          targets: ['tag'],
          actorTarget: 'all',
        })

        const a = await agent.getPreferences()
        const word = a.moderationPrefs.mutedWords.find(
          (m) => m.value === 'word',
        )

        await agent.updateMutedWord({
          ...word!,
          targets: ['content'],
        })

        const b = await agent.getPreferences()

        expect(
          b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
        ).toHaveProperty('targets', ['content'])
      })

      it('updates actorTarget', async () => {
        await agent.addMutedWord({
          value: 'value',
          targets: ['content'],
          actorTarget: 'all',
        })

        const a = await agent.getPreferences()
        const word = a.moderationPrefs.mutedWords.find(
          (m) => m.value === 'value',
        )

        await agent.updateMutedWord({
          ...word!,
          actorTarget: 'exclude-following',
        })

        const b = await agent.getPreferences()

        expect(
          b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
        ).toHaveProperty('actorTarget', 'exclude-following')
      })

      it('updates expiresAt', async () => {
        const expiresAt = new Date(Date.now() + 6e3).toISOString()
        const expiresAt2 = new Date(Date.now() + 10e3).toISOString()
        await agent.addMutedWord({
          value: 'value',
          targets: ['content'],
          expiresAt,
          actorTarget: 'all',
        })

        const a = await agent.getPreferences()
        const word = a.moderationPrefs.mutedWords.find(
          (m) => m.value === 'value',
        )

        await agent.updateMutedWord({
          ...word!,
          expiresAt: expiresAt2,
        })

        const b = await agent.getPreferences()

        expect(
          b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
        ).toHaveProperty('expiresAt', expiresAt2)
      })

      it(`doesn't update if value is sanitized to be falsy`, async () => {
        await agent.addMutedWord({
          value: 'rug',
          targets: ['content'],
          actorTarget: 'all',
        })

        const a = await agent.getPreferences()
        const word = a.moderationPrefs.mutedWords.find((m) => m.value === 'rug')

        await agent.updateMutedWord({
          ...word!,
          value: '',
        })

        const b = await agent.getPreferences()

        expect(
          b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
        ).toHaveProperty('value', 'rug')
      })
    })

    describe('removeMutedWord', () => {
      it('removes word', async () => {
        await agent.addMutedWord({
          value: 'word',
          targets: ['tag'],
          actorTarget: 'all',
        })
        const a = await agent.getPreferences()
        const word = a.moderationPrefs.mutedWords.find(
          (m) => m.value === 'word',
        )

        await agent.removeMutedWord(word!)

        const b = await agent.getPreferences()

        expect(
          b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
        ).toBeFalsy()
      })

      it(`word doesn't exist, no action`, async () => {
        await agent.addMutedWord({
          value: 'word',
          targets: ['tag'],
          actorTarget: 'all',
        })
        const a = await agent.getPreferences()
        const word = a.moderationPrefs.mutedWords.find(
          (m) => m.value === 'word',
        )

        await agent.removeMutedWord({
          value: 'another',
          targets: [],
          actorTarget: 'all',
        })

        const b = await agent.getPreferences()

        expect(
          b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
        ).toBeTruthy()
      })
    })

    describe('removeMutedWords', () => {
      it(`removes sequentially, no clobbering`, async () => {
        await agent.addMutedWords([
          { value: 'a', targets: ['content'], actorTarget: 'all ' },
          { value: 'b', targets: ['content'], actorTarget: 'all ' },
          { value: 'c', targets: ['content'], actorTarget: 'all ' },
        ])

        const a = await agent.getPreferences()
        await agent.removeMutedWords(a.moderationPrefs.mutedWords)
        const b = await agent.getPreferences()

        expect(b.moderationPrefs.mutedWords.length).toEqual(0)
      })
    })
  })

  describe('legacy muted words', () => {
    // @NOTE legacy muted words have no id
    const legacyMutedWordsPref = (
      ...items: Omit<AppBskyActorDefs.MutedWord, 'id'>[]
    ) => ({ $type: 'app.bsky.actor.defs#mutedWordsPref', items })

    describe(`upsertMutedWords (and addMutedWord)`, () => {
      it(`adds new word, migrates old words`, async () => {
        const { agent } = preferencesStore([
          legacyMutedWordsPref({
            value: 'word',
            targets: ['content'],
            actorTarget: 'all',
          }),
        ])

        {
          const { moderationPrefs } = await agent.getPreferences()
          const word = moderationPrefs.mutedWords.find(
            (w) => w.value === 'word',
          )
          expect(word).toBeTruthy()
          expect(word!.id).toBeFalsy()
        }

        await agent.upsertMutedWords([
          { value: 'word2', targets: ['tag'], actorTarget: 'all' },
        ])

        {
          const { moderationPrefs } = await agent.getPreferences()
          const word = moderationPrefs.mutedWords.find(
            (w) => w.value === 'word',
          )
          const word2 = moderationPrefs.mutedWords.find(
            (w) => w.value === 'word2',
          )

          expect(word!.id).toBeTruthy()
          expect(word2!.id).toBeTruthy()
        }
      })
    })

    describe(`updateMutedWord`, () => {
      it(`updates legacy word, migrates old words`, async () => {
        const { agent } = preferencesStore([
          legacyMutedWordsPref(
            { value: 'word', targets: ['content'], actorTarget: 'all' },
            { value: 'word2', targets: ['tag'], actorTarget: 'all' },
          ),
        ])

        await agent.updateMutedWord({
          value: 'word',
          targets: ['tag'],
          actorTarget: 'all',
        })

        {
          const { moderationPrefs } = await agent.getPreferences()
          const word = moderationPrefs.mutedWords.find(
            (w) => w.value === 'word',
          )
          const word2 = moderationPrefs.mutedWords.find(
            (w) => w.value === 'word2',
          )

          expect(moderationPrefs.mutedWords.length).toEqual(2)
          expect(word!.id).toBeTruthy()
          expect(word!.targets).toEqual(['tag'])
          expect(word2!.id).toBeTruthy()
        }
      })
    })

    describe(`removeMutedWord`, () => {
      it(`removes legacy word, migrates old words`, async () => {
        const { agent } = preferencesStore([
          legacyMutedWordsPref(
            { value: 'word', targets: ['content'], actorTarget: 'all' },
            { value: 'word2', targets: ['tag'], actorTarget: 'all' },
          ),
        ])

        await agent.removeMutedWord({
          value: 'word',
          targets: ['tag'],
          actorTarget: 'all',
        })

        {
          const { moderationPrefs } = await agent.getPreferences()
          const word = moderationPrefs.mutedWords.find(
            (w) => w.value === 'word',
          )
          const word2 = moderationPrefs.mutedWords.find(
            (w) => w.value === 'word2',
          )

          expect(moderationPrefs.mutedWords.length).toEqual(1)
          expect(word).toBeFalsy()
          expect(word2!.id).toBeTruthy()
        }
      })
    })
  })
})
