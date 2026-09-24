import { jest } from '@jest/globals'
import { XrpcInternalError, XrpcResponseError } from '@atproto/lex'
import { EventPusher } from '../src/daemon/event-pusher.js'
import { com } from '../src/lexicons/index.js'

const subject = {
  $type: 'com.atproto.admin.defs#repoRef' as const,
  did: 'did:plc:test',
}

const updateSubjectStatusMethod = com.atproto.admin.updateSubjectStatus as any

const responseError = (
  status: number,
  error: string,
  message: string,
  headers?: HeadersInit,
) =>
  new XrpcResponseError(
    updateSubjectStatusMethod,
    new Response(null, { status, headers }),
    {
      encoding: 'application/json',
      body: { error, message },
    },
  )

describe('EventPusher', () => {
  const createPusher = () =>
    new EventPusher(
      {} as ConstructorParameters<typeof EventPusher>[0],
      async () => ({ headers: { authorization: 'Bearer test' } }),
      {
        pds: {
          url: 'https://pds.test',
          did: 'did:web:pds.test',
        },
      },
    )

  const updateSubject = (pusher: EventPusher) =>
    (pusher as any).updateSubjectOnService(pusher.pds, subject, 'TAKEDOWN-1')

  it.each([
    ['NotFound', 'Repo not found'],
    ['InvalidRequest', 'Could not find account'],
  ])(
    'confirms events when the target account does not exist (%s)',
    async (error, message) => {
      const pusher = createPusher()
      const updateSubjectStatus = jest
        .fn<() => Promise<never>>()
        .mockRejectedValue(responseError(400, error, message))
      pusher.pds!.client.call = updateSubjectStatus as any

      await expect(updateSubject(pusher)).resolves.toBe('confirmed')
      expect(updateSubjectStatus).toHaveBeenCalledTimes(1)
    },
  )

  it('defers events until the target service rate limit resets', async () => {
    const pusher = createPusher()
    const resetAt = Math.ceil(Date.now() / 1000) + 60
    const updateSubjectStatus = jest
      .fn<() => Promise<never>>()
      .mockRejectedValue(
        responseError(429, 'RateLimitExceeded', 'Rate Limit Exceeded', {
          'ratelimit-reset': String(resetAt),
        }),
      )
    pusher.pds!.client.call = updateSubjectStatus as any

    await expect(updateSubject(pusher)).resolves.toBe('deferred')
    await expect(updateSubject(pusher)).resolves.toBe('deferred')
    expect(updateSubjectStatus).toHaveBeenCalledTimes(1)
    expect(pusher.pds!.rateLimitedUntil).toBe(resetAt * 1000)
  })

  it('retries transport failures', async () => {
    const pusher = createPusher()
    const updateSubjectStatus = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(
        new XrpcInternalError(updateSubjectStatusMethod, 'Transport failure'),
      )
      .mockResolvedValueOnce({})
    pusher.pds!.client.call = updateSubjectStatus as any

    await expect(updateSubject(pusher)).resolves.toBe('confirmed')
    expect(updateSubjectStatus).toHaveBeenCalledTimes(2)
  })

  it('does not clear a rate limit set by a concurrent request', async () => {
    const pusher = createPusher()
    const rateLimitedUntil = Date.now() + 60_000
    const updateSubjectStatus = jest
      .fn<() => Promise<unknown>>()
      .mockImplementation(async () => {
        pusher.pds!.rateLimitedUntil = rateLimitedUntil
        return {}
      })
    pusher.pds!.client.call = updateSubjectStatus as any

    await expect(updateSubject(pusher)).resolves.toBe('confirmed')
    expect(pusher.pds!.rateLimitedUntil).toBe(rateLimitedUntil)
  })
})
