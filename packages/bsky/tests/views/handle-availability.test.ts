import assert from 'node:assert'
import {
  $Typed,
  AppBskyUnspeccedCheckHandleAvailability,
  AtpAgent,
} from '@atproto/api'
import { InvalidEmailError } from '@atproto/api/dist/client/types/app/bsky/unspecced/checkHandleAvailability'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import {
  OutputSchema,
  ResultAvailable,
  ResultUnavailable,
} from '../../src/lexicon/types/app/bsky/unspecced/checkHandleAvailability'

describe('handle availability', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let did: string
  let handle: string
  let handleSubdomain: string
  const birthDate = '1980-09-11T18:05:42.556Z'

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_handle_availability',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    did = sc.dids.alice
    handle = sc.accounts[did].handle
    handleSubdomain = handle.split('.')[0]
  })

  afterAll(async () => {
    await network.close()
  })

  describe('validation', () => {
    it('throws if email passed is invalid', async () => {
      await expect(
        agent.app.bsky.unspecced.checkHandleAvailability({
          handle,
          email: 'not-an-email',
        }),
      ).rejects.toThrow(InvalidEmailError)
    })
  })

  describe('available handle', () => {
    it('returns available when trying a non-existing handle', async () => {
      const handle = 'a5cc0a41-f9a3-4351-b9ec-1462f255fb0a.test'
      const { data } = await agent.app.bsky.unspecced.checkHandleAvailability({
        handle,
      })

      expect(data.handle).toBe(handle)
      assertAvailable(data.result)
    })
  })

  describe('unavailable handle', () => {
    it('returns unavailable when trying an existing handle', async () => {
      const { data } = await agent.app.bsky.unspecced.checkHandleAvailability({
        handle,
      })

      expect(data.handle).toBe(handle)
      assertUnavailable(data.result)
    })

    it(`returns empty list if can't create suggestions`, async () => {
      // This handle has the maximum allowed length. Suggestions are additive,
      // so no valid suggestion can be made by adding characters.
      const longestAllowedHandle = 'abcdefghijklmnopqr.test'
      const userMaxLength = {
        email: 'usermaxlength@mail.com',
        handle: longestAllowedHandle,
        password: 'hunter2',
      }
      await sc.createAccount('userMaxLength', userMaxLength)
      await network.processAll()
      const { data } = await agent.app.bsky.unspecced.checkHandleAvailability({
        handle: longestAllowedHandle,
      })

      expect(data.handle).toBe(longestAllowedHandle)
      assertUnavailable(data.result)
      expect(data.result.suggestions).toHaveLength(0)
    })

    describe('suggestions', () => {
      it('suggests appending YOB to tentative handle', async () => {
        const {
          data: { result },
        } = await agent.app.bsky.unspecced.checkHandleAvailability({
          handle,
          birthDate,
        })

        assertUnavailable(result)
        const suggestion = result.suggestions.find(
          (s) => s.method === 'handle_yob',
        )
        expect(suggestion?.handle).toBe(`${handleSubdomain}80.test`)
      })

      it('suggests appending YOB to tentative handle, with hyphen if label ends with digits', async () => {
        const user1 = {
          email: 'user1@mail.com',
          handle: 'user1.test',
          password: 'hunter2',
        }
        await sc.createAccount('user1', user1)
        await network.processAll()

        const {
          data: { result },
        } = await agent.app.bsky.unspecced.checkHandleAvailability({
          handle: user1.handle,
          birthDate,
        })

        assertUnavailable(result)
        const suggestion = result.suggestions.find(
          (s) => s.method === 'handle_yob',
        )
        expect(suggestion?.handle).toBe('user1-80.test')
      })

      it('suggests using email', async () => {
        const {
          data: { result },
        } = await agent.app.bsky.unspecced.checkHandleAvailability({
          handle,
          email: 'email@mail.com',
        })

        assertUnavailable(result)
        const suggestion = result.suggestions.find((s) => s.method === 'email')
        expect(suggestion?.handle).toBe('email.test')
      })

      it('suggests user email with and without YOB', async () => {
        const {
          data: { result },
        } = await agent.app.bsky.unspecced.checkHandleAvailability({
          handle,
          email: 'email@mail.com',
          birthDate,
        })

        assertUnavailable(result)

        const suggestion0 = result.suggestions.find((s) => s.method === 'email')
        expect(suggestion0?.handle).toBe('email.test')

        const suggestion1 = result.suggestions.find(
          (s) => s.method === 'email_yob',
        )
        expect(suggestion1?.handle).toBe('email80.test')
      })

      it('does not suggest email if it is unavailable as handle', async () => {
        const user2 = {
          email: 'user2@mail.com',
          handle: 'some-name.test', // NOTE: this handle is taken.
          password: 'hunter2',
        }
        await sc.createAccount('user2', user2)
        await network.processAll()

        const {
          data: { result },
        } = await agent.app.bsky.unspecced.checkHandleAvailability({
          handle,
          email: 'some.name@mail.com', // NOTE: would suggest 'some-name.test' from the email, but it is taken.
          birthDate,
        })

        assertUnavailable(result)

        const suggestion0 = result.suggestions.find((s) => s.method === 'email')
        expect(suggestion0).toBeUndefined()

        const suggestion1 = result.suggestions.find(
          (s) => s.method === 'email_yob',
        )
        expect(suggestion1?.handle).toBe('some-name80.test')
      })

      it('suggests random hyphens in the middle of handle', async () => {
        const {
          data: { result },
        } = await agent.app.bsky.unspecced.checkHandleAvailability({
          handle,
        })

        assertUnavailable(result)
        const suggestion = result.suggestions.find((s) =>
          s.handle.includes('-'),
        )
        assert(suggestion)
        expect(suggestion).not.toBe(handle)
        expect(suggestion.handle.replace('-', '')).toBe(handle)
      })

      it('suggests random digits at the end of handle', async () => {
        const {
          data: { result },
        } = await agent.app.bsky.unspecced.checkHandleAvailability({
          handle,
        })

        assertUnavailable(result)
        const suggestion = result.suggestions.find((s) =>
          /\d+$/.test(s.handle.split('.')[0]),
        )
        assert(suggestion)
        expect(suggestion).not.toBe(handle)
        expect(suggestion.handle.replace(/\d+/, '')).toBe(handle)
      })
    })
  })
})

function assertAvailable(
  r: OutputSchema['result'],
): asserts r is $Typed<ResultAvailable> {
  assert(AppBskyUnspeccedCheckHandleAvailability.isResultAvailable(r))
}

function assertUnavailable(
  r: OutputSchema['result'],
): asserts r is $Typed<ResultUnavailable> {
  assert(AppBskyUnspeccedCheckHandleAvailability.isResultUnavailable(r))
}
