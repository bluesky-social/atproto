import { describe, expect, it, vi } from 'vitest'
import { SetupStack } from './setup-stack.js'

function resource(name: string, calls: string[]) {
  return {
    async [Symbol.asyncDispose]() {
      await new Promise((resolve) => setTimeout(resolve, 1))
      calls.push(name)
    },
  }
}

describe(SetupStack, () => {
  it('disposes nothing once ownership is moved out', async () => {
    const calls: string[] = []

    async function create() {
      await using stack = new SetupStack()
      const first = stack.use(resource('first', calls))
      stack.defer(() => {
        calls.push('deferred')
      })
      stack.move()
      return first
    }

    await expect(create()).resolves.toBeDefined()
    expect(calls).toEqual([])
  })

  it('disposes what was registered, most recent first, when setup throws', async () => {
    const calls: string[] = []
    const error = new Error('third step failed')

    async function create() {
      await using stack = new SetupStack()
      stack.use(resource('first', calls))
      stack.defer(() => {
        calls.push('second')
      })
      stack.use(resource('third', calls))
      throw error
    }

    await expect(create()).rejects.toBe(error)
    expect(calls).toEqual(['third', 'second', 'first'])
  })

  it('rethrows the setup error, not a SuppressedError, when disposing fails', async () => {
    const error = new Error('setup failed')
    const first = vi.fn()

    async function create() {
      await using stack = new SetupStack()
      stack.defer(first)
      stack.defer(() => {
        throw new Error('sync cleanup failed')
      })
      stack.defer(async () => {
        throw new Error('async cleanup failed')
      })
      throw error
    }

    await expect(create()).rejects.toBe(error)
    expect(first).toHaveBeenCalledOnce()
  })
})
