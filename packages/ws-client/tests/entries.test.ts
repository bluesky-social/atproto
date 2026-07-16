import { describe, expect, expectTypeOf, it } from 'vitest'
import * as browser from '../src/browser.ts'
import * as node from '../src/node.ts'

describe('entrypoint parity', () => {
  it('exports the same named members', () => {
    const nodeKeys = Object.keys(node).sort()
    const browserKeys = Object.keys(browser).sort()
    expect(nodeKeys).toEqual(browserKeys)
  })

  it('both export a constructable WebSocketConnection', () => {
    expect(typeof node.WebSocketConnection).toBe('function')
    expect(typeof browser.WebSocketConnection).toBe('function')
  })

  it('both export a constructable WebSocketClient', () => {
    expect(typeof node.WebSocketClient).toBe('function')
    expect(typeof browser.WebSocketClient).toBe('function')
  })

  it('browser constructor options are a subset of node constructor options', () => {
    // Pure type-level assertions: constructing a real WebSocketConnection here
    // would open a socket to an unreachable URL, which is unnecessary risk
    // for what is otherwise a type-only check.
    //
    // The two entrypoints intentionally differ: the browser signatures narrow
    // the options to the browser-supported subset (no `headers`), so any valid
    // browser options object is also valid node options — not vice versa.
    expectTypeOf<
      NonNullable<ConstructorParameters<typeof browser.WebSocketConnection>[1]>
    >().toExtend<
      NonNullable<ConstructorParameters<typeof node.WebSocketConnection>[1]>
    >()
    expectTypeOf<
      NonNullable<ConstructorParameters<typeof browser.WebSocketClient>[1]>
    >().toExtend<
      NonNullable<ConstructorParameters<typeof node.WebSocketClient>[1]>
    >()
    // headers is the one node-only option: present on node, absent on browser.
    expectTypeOf<
      NonNullable<ConstructorParameters<typeof node.WebSocketConnection>[1]>
    >().toHaveProperty('headers')
    expectTypeOf<
      keyof NonNullable<
        ConstructorParameters<typeof browser.WebSocketConnection>[1]
      >
    >().not.toExtend<'headers'>()
  })

  it('binary dataMode binds Uint8Array on both entries', () => {
    // Type-level only: no instance is constructed (that would open a real
    // socket). MessageOf<'binary'> resolves to Uint8Array on both entries,
    // and the two WebSocketConnection<'binary'> instance types are identical.
    expectTypeOf<node.MessageOf<'binary'>>().toEqualTypeOf<Uint8Array>()
    expectTypeOf<browser.MessageOf<'binary'>>().toEqualTypeOf<Uint8Array>()
    expectTypeOf<
      InstanceType<typeof node.WebSocketConnection<'binary'>>
    >().toEqualTypeOf<
      InstanceType<typeof browser.WebSocketConnection<'binary'>>
    >()
  })
})
