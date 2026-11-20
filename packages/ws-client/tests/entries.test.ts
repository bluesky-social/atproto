import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  BrowserWebSocketOptions,
  MessageOf,
  NodeWebSocketOptions,
  WebSocketIterable,
} from '../src/index.ts'
import { backoffMs, websocket } from '../src/index.ts'

describe('public entrypoint', () => {
  it('exports websocket() as the one way to consume a socket', () => {
    expect(typeof websocket).toBe('function')
  })

  it('exports the backoff schedule for redials of its own', () => {
    expect(typeof backoffMs).toBe('function')
  })

  it('offers no close()/terminate() on the stream', () => {
    // Stopping is one idiom: break/throw on the iteration, or an aborted signal.
    // Guards against a close-shaped method creeping back onto the generator,
    // giving callers a second, unspecified way to stop. A sender's close() ends
    // only its connection, leaving what follows to the reconnect policy.
    const gen = websocket('ws://example.invalid', { shouldReconnect: false })
    const names = new Set<string>()
    for (
      let obj: object | null = gen;
      obj && obj !== Object.prototype;
      obj = Object.getPrototypeOf(obj)
    ) {
      for (const key of Object.getOwnPropertyNames(obj)) names.add(key)
    }
    expect([...names].filter((n) => /close|terminate/i.test(n))).toEqual([])
    // Never iterated, so the generator body never ran and no socket was opened.
  })

  it('types browser options as a subset of node options', () => {
    expectTypeOf<BrowserWebSocketOptions>().toExtend<NodeWebSocketOptions>()
    // headers and lookup are the node-only options the browser throws on.
    expectTypeOf<NodeWebSocketOptions>().toHaveProperty('headers')
    expectTypeOf<NodeWebSocketOptions>().toHaveProperty('lookup')
    expectTypeOf<keyof BrowserWebSocketOptions>().not.toExtend<'headers'>()
    expectTypeOf<keyof BrowserWebSocketOptions>().not.toExtend<'lookup'>()
  })

  it('binds dataMode to the yielded type, with all generator type args', () => {
    expectTypeOf<MessageOf<'binary'>>().toEqualTypeOf<Uint8Array<ArrayBuffer>>()
    expectTypeOf<MessageOf<'text'>>().toEqualTypeOf<string>()
    // The named alias is what consumers annotate with, so it has to stay
    // equivalent to the spelled-out generator, all three type args included —
    // omitting them defaults TReturn and TNext to `any`, which would silently
    // un-type next()/return().
    expectTypeOf<WebSocketIterable<'binary'>>().toEqualTypeOf<
      AsyncGenerator<Uint8Array<ArrayBuffer>, void, unknown>
    >()
    expectTypeOf(websocket<'binary'>).returns.toEqualTypeOf<
      WebSocketIterable<'binary'>
    >()
  })
})
