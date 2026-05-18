import {
  StreamRequest,
  StreamResponse,
  UnaryRequest,
  UnaryResponse,
} from '@connectrpc/connect'
import { describe, expect, it, vi } from 'vitest'
import { callerInterceptor } from './util.js'

describe('callerInterceptor', () => {
  it('sets x-atlantis-caller header on the request', async () => {
    const fakeRequest = { header: new Headers({ 'x-other': 'value' }) } as
      | UnaryRequest
      | StreamRequest
    const fakeResponse = {} as UnaryResponse | StreamResponse
    const fakeHandler = vi.fn(async (_req: UnaryRequest | StreamRequest) => {
      return fakeResponse
    })

    const interceptor = callerInterceptor('appview')
    const next = interceptor(fakeHandler)
    const res = await next(fakeRequest)

    expect(fakeRequest.header.get('x-atlantis-caller')).toBe('appview')
    expect(fakeRequest.header.get('x-other')).toBe('value')
    expect(fakeHandler).toHaveBeenCalledWith(fakeRequest)
    expect(res).toBe(fakeResponse)
  })
})
