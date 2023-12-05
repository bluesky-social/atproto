import { retry } from '../src/index'

describe('retry', () => {
  describe('retry()', () => {
    it('retries until max retries', async () => {
      let fnCalls = 0
      let waitMsCalls = 0
      const fn = async () => {
        fnCalls++
        throw new Error(`Oops ${fnCalls}!`)
      }
      const getWaitMs = (retries) => {
        waitMsCalls++
        expect(retries).toEqual(waitMsCalls - 1)
        return 0
      }
      await expect(retry(fn, { maxRetries: 13, getWaitMs })).rejects.toThrow(
        'Oops 14!',
      )
      expect(fnCalls).toEqual(14)
      expect(waitMsCalls).toEqual(14)
    })

    it('retries until max wait', async () => {
      let fnCalls = 0
      let waitMsCalls = 0
      const fn = async () => {
        fnCalls++
        throw new Error(`Oops ${fnCalls}!`)
      }
      const getWaitMs = (retries) => {
        waitMsCalls++
        expect(retries).toEqual(waitMsCalls - 1)
        if (retries === 13) {
          return null
        }
        return 0
      }
      await expect(
        retry(fn, { maxRetries: Infinity, getWaitMs }),
      ).rejects.toThrow('Oops 14!')
      expect(fnCalls).toEqual(14)
      expect(waitMsCalls).toEqual(14)
    })

    it('retries until non-retryable error', async () => {
      let fnCalls = 0
      let waitMsCalls = 0
      const fn = async () => {
        fnCalls++
        throw new Error(`Oops ${fnCalls}!`)
      }
      const getWaitMs = (retries) => {
        waitMsCalls++
        expect(retries).toEqual(waitMsCalls - 1)
        return 0
      }
      const retryable = (err: unknown) => err?.['message'] !== 'Oops 14!'
      await expect(
        retry(fn, { maxRetries: Infinity, getWaitMs, retryable }),
      ).rejects.toThrow('Oops 14!')
      expect(fnCalls).toEqual(14)
      expect(waitMsCalls).toEqual(14)
    })

    it('returns latest result after retries', async () => {
      let fnCalls = 0
      const fn = async () => {
        fnCalls++
        if (fnCalls < 14) {
          throw new Error(`Oops ${fnCalls}!`)
        }
        return 'ok'
      }
      const getWaitMs = () => 0
      const result = await retry(fn, { maxRetries: Infinity, getWaitMs })
      expect(result).toBe('ok')
      expect(fnCalls).toBe(14)
    })

    it('returns result immediately on success', async () => {
      let fnCalls = 0
      const fn = async () => {
        fnCalls++
        return 'ok'
      }
      const getWaitMs = () => 0
      const result = await retry(fn, { maxRetries: Infinity, getWaitMs })
      expect(result).toBe('ok')
      expect(fnCalls).toBe(1)
    })
  })
})
