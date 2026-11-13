import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeFedcmLogin } from './fedcm.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe(completeFedcmLogin, () => {
  it('updates the FedCM login status and closes the login window', async () => {
    const setStatus = vi.fn()
    const close = vi.fn()
    vi.stubGlobal('navigator', { login: { setStatus } })
    vi.stubGlobal('window', { IdentityProvider: { close } })

    await completeFedcmLogin()

    expect(setStatus).toHaveBeenCalledWith('logged-in')
    expect(close).toHaveBeenCalledOnce()
  })

  it('tolerates unsupported APIs and browser failures', async () => {
    const setStatus = vi.fn(() => {
      throw new Error('unsupported')
    })
    const close = vi.fn(() => {
      throw new Error('unsupported')
    })
    vi.stubGlobal('navigator', { login: { setStatus } })
    vi.stubGlobal('window', { IdentityProvider: { close } })

    await expect(completeFedcmLogin()).resolves.toBeUndefined()

    expect(setStatus).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('does nothing when the browser exposes neither API', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', {})

    await expect(completeFedcmLogin()).resolves.toBeUndefined()
  })
})
