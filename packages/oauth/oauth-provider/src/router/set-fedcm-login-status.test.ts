import type { ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { DeviceAccount } from '../account/account-store.js'
import { deviceIdSchema } from '../device/device-id.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { setFedcmLoginStatus } from './set-fedcm-login-status.js'

const deviceId = deviceIdSchema.parse(`dev-${'a'.repeat(32)}`)

describe(setFedcmLoginStatus, () => {
  it('does not query accounts or change the response when FedCM is disabled', async () => {
    const fake = provider({ fedcm: false })
    const { res, setHeader } = response()

    await setFedcmLoginStatus(fake, deviceId, res)

    expect(fake.listFedcmAccounts).not.toHaveBeenCalled()
    expect(setHeader).not.toHaveBeenCalled()
  })

  it('keeps login status when an eligible account remains', async () => {
    const fake = provider({ accounts: [{} as DeviceAccount] })
    const { res, setHeader } = response()

    await setFedcmLoginStatus(fake, deviceId, res)

    expect(fake.listFedcmAccounts).toHaveBeenCalledWith(deviceId)
    expect(setHeader).toHaveBeenCalledOnce()
    expect(setHeader).toHaveBeenCalledWith('Set-Login', 'logged-in')
  })

  it('marks the browser logged out when no eligible accounts remain', async () => {
    const fake = provider({ accounts: [] })
    const { res, setHeader } = response()

    await setFedcmLoginStatus(fake, deviceId, res)

    expect(fake.listFedcmAccounts).toHaveBeenCalledWith(deviceId)
    expect(setHeader).toHaveBeenCalledOnce()
    expect(setHeader).toHaveBeenCalledWith('Set-Login', 'logged-out')
  })
})

function provider({
  fedcm = {},
  accounts = [{} as DeviceAccount],
}: {
  fedcm?: false | { allowLoopbackClients?: boolean }
  accounts?: DeviceAccount[]
} = {}) {
  return {
    fedcm,
    listFedcmAccounts: vi.fn(async () => accounts),
  } as unknown as OAuthProvider
}

function response() {
  const setHeader = vi.fn()
  const res = { setHeader } as unknown as ServerResponse
  return { res, setHeader }
}
