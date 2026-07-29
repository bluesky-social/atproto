import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  BrowserWebSocketOptions,
  MessageOf,
  NodeWebSocketOptions,
} from '../src/index.ts'
import { websocket } from '../src/index.ts'

describe('public entrypoint', () => {
  it('exports websocket() as the one way to consume a socket', () => {
    expect(typeof websocket).toBe('function')
  })

  it('types browser options as a subset of node options', () => {
    expectTypeOf<BrowserWebSocketOptions>().toExtend<NodeWebSocketOptions>()
    // headers is the one node-only option.
    expectTypeOf<NodeWebSocketOptions>().toHaveProperty('headers')
    expectTypeOf<keyof BrowserWebSocketOptions>().not.toExtend<'headers'>()
  })

  it('binds dataMode to the yielded type, with all generator type args', () => {
    expectTypeOf<MessageOf<'binary'>>().toEqualTypeOf<Uint8Array>()
    expectTypeOf<MessageOf<'text'>>().toEqualTypeOf<string>()
    expectTypeOf(websocket<'binary'>).returns.toEqualTypeOf<
      AsyncGenerator<Uint8Array, void, undefined>
    >()
  })
})
