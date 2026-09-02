import { jest } from '@jest/globals'
import { XRPCError } from '@atproto/xrpc'
import { EventPusher } from '../src/daemon/event-pusher.js'

const subject = {
  $type: 'com.atproto.admin.defs#repoRef' as const,
  did: 'did:plc:test',
}

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

  it('confirms events when the target account does not exist', async () => {
    const pusher = createPusher()
    const updateSubjectStatus = jest
      .fn<() => Promise<never>>()
      .mockRejectedValue(new XRPCError(400, 'NotFound', 'Repo not found'))
    pusher.pds!.agent.com.atproto.admin.updateSubjectStatus =
      updateSubjectStatus as any

    await expect(updateSubject(pusher)).resolves.toBe('confirmed')
    expect(updateSubjectStatus).toHaveBeenCalledTimes(1)
  })

  it('defers events until the target service rate limit resets', async () => {
    const pusher = createPusher()
    const resetAt = Math.ceil(Date.now() / 1000) + 60
    const updateSubjectStatus = jest
      .fn<() => Promise<never>>()
      .mockRejectedValue(
        new XRPCError(429, 'RateLimitExceeded', 'Rate Limit Exceeded', {
          'ratelimit-reset': String(resetAt),
        }),
      )
    pusher.pds!.agent.com.atproto.admin.updateSubjectStatus =
      updateSubjectStatus as any

    await expect(updateSubject(pusher)).resolves.toBe('deferred')
    await expect(updateSubject(pusher)).resolves.toBe('deferred')
    expect(updateSubjectStatus).toHaveBeenCalledTimes(1)
    expect(pusher.pds!.rateLimitedUntil).toBe(resetAt * 1000)
  })

  it('retries transport failures', async () => {
    const pusher = createPusher()
    const updateSubjectStatus = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new XRPCError(1))
      .mockResolvedValueOnce({})
    pusher.pds!.agent.com.atproto.admin.updateSubjectStatus =
      updateSubjectStatus as any

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
    pusher.pds!.agent.com.atproto.admin.updateSubjectStatus =
      updateSubjectStatus as any

    await expect(updateSubject(pusher)).resolves.toBe('confirmed')
    expect(pusher.pds!.rateLimitedUntil).toBe(rateLimitedUntil)
  })
})
