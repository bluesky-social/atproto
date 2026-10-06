import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { DeviceData } from './device-data.js'
import { deviceIdSchema } from './device-id.js'
import { DeviceManager } from './device-manager.js'
import type { DeviceId, DeviceStore } from './device-store.js'
import { sessionIdSchema } from './session-id.js'

const deviceId = deviceIdSchema.parse(`dev-${'d'.repeat(32)}`)
const sessionId = sessionIdSchema.parse(`ses-${'s'.repeat(32)}`)
const staleSessionId = sessionIdSchema.parse(`ses-${'x'.repeat(32)}`)
const fedcmDeviceCookie = '__Secure-atproto-fedcm-device'
const fedcmSessionCookie = '__Secure-atproto-fedcm-session'
const userAgent = 'test browser'
const ipAddress = '127.0.0.1'

function deviceData(overrides: Partial<DeviceData> = {}): DeviceData {
  return {
    sessionId,
    lastSeenAt: new Date(),
    userAgent,
    ipAddress,
    ...overrides,
  }
}

function createStore(initial?: DeviceData) {
  const devices = new Map<DeviceId, DeviceData>()
  if (initial) devices.set(deviceId, initial)

  const store: DeviceStore = {
    createDevice: vi.fn(async (id: DeviceId, data: DeviceData) => {
      devices.set(id, data)
    }),
    readDevice: vi.fn(async (id: DeviceId) => devices.get(id) ?? null),
    updateDevice: vi.fn(async (id: DeviceId, data: Partial<DeviceData>) => {
      const current = devices.get(id)
      if (current) devices.set(id, { ...current, ...data })
    }),
    deleteDevice: vi.fn(async (id: DeviceId) => {
      devices.delete(id)
    }),
  }

  return { store, devices }
}

function request(cookie?: string): IncomingMessage {
  return {
    headers: { cookie, 'user-agent': userAgent },
    socket: { remoteAddress: ipAddress, remotePort: 1234 },
  } as unknown as IncomingMessage
}

function response() {
  const headers = new Map<string, string | number | string[]>()
  const res = {
    getHeader(name: string) {
      return headers.get(name.toLowerCase())
    },
    setHeader(name: string, value: string | number | string[]) {
      headers.set(name.toLowerCase(), value)
      return res
    },
  } as unknown as ServerResponse

  return { res, headers }
}

function setCookieLines(headers: Map<string, string | number | string[]>) {
  const value = headers.get('set-cookie')
  if (Array.isArray(value)) return value
  return typeof value === 'string' ? [value] : []
}

function cookieValue(lines: string[], name: string) {
  const line = lines.find((value) => value.startsWith(`${name}=`))
  return line?.split(';', 1)[0]?.slice(name.length + 1)
}

function cookieHeader(...cookies: [string, string][]) {
  return cookies.map(([name, value]) => `${name}=${value}`).join('; ')
}

function primaryCookieHeader(id = deviceId, session = sessionId) {
  return cookieHeader(['dev-id', id], ['ses-id', session])
}

function fedcmCookieHeader(id = deviceId, session = sessionId) {
  return cookieHeader([fedcmDeviceCookie, id], [fedcmSessionCookie, session])
}

function createKeys() {
  return {
    sign: (value: unknown) => `sig-${String(value)}`,
    verify: (value: unknown, hash: string) => hash === `sig-${String(value)}`,
    index: (value: unknown, hash: string) =>
      hash === `sig-${String(value)}` ? 0 : -1,
  }
}

describe('DeviceManager FedCM shadow session', () => {
  it('stays disabled by default and does not write shadow cookies', async () => {
    const { store } = createStore()
    const manager = new DeviceManager(store)

    await expect(
      manager.readFedcmDevice(request(fedcmCookieHeader())),
    ).resolves.toBeNull()
    expect(store.readDevice).not.toHaveBeenCalled()

    const res = response()
    await manager.load(request(), res.res)

    const lines = setCookieLines(res.headers)
    expect(lines.some((line) => line.startsWith(`${fedcmDeviceCookie}=`))).toBe(
      false,
    )
    expect(
      lines.some((line) => line.startsWith(`${fedcmSessionCookie}=`)),
    ).toBe(false)
  })

  it('writes secure, cross-site shadow cookies independently of primary cookie security', async () => {
    const { store } = createStore()
    const manager = new DeviceManager(
      store,
      { cookie: { secure: false } },
      true,
    )
    const res = response()

    await manager.load(request(), res.res)

    const lines = setCookieLines(res.headers)
    const shadowLines = lines.filter(
      (line) =>
        line.startsWith(`${fedcmDeviceCookie}=`) ||
        line.startsWith(`${fedcmSessionCookie}=`),
    )
    expect(shadowLines).toHaveLength(2)
    for (const line of shadowLines) {
      const attributes = line
        .split(';')
        .slice(1)
        .map((attribute) => attribute.trim().toLowerCase())
      expect(attributes).toContain('path=/oauth/fedcm')
      expect(attributes).toContain('httponly')
      expect(attributes).toContain('secure')
      expect(attributes).toContain('samesite=none')
    }

    const primaryLines = lines.filter(
      (line) => line.startsWith('dev-id=') || line.startsWith('ses-id='),
    )
    expect(primaryLines).toHaveLength(2)
    for (const line of primaryLines) {
      expect(line.toLowerCase()).not.toContain('; secure')
    }
  })

  it('signs the shadow pair with the configured keys and shadow cookie attributes', async () => {
    const { store } = createStore(deviceData())
    const keys = createKeys()
    const manager = new DeviceManager(store, { cookie: { keys } }, true)
    const res = response()

    await manager.load(
      request(
        cookieHeader(
          ['dev-id', deviceId],
          ['dev-id:hash', keys.sign(deviceId)],
          ['ses-id', sessionId],
          ['ses-id:hash', keys.sign(sessionId)],
        ),
      ),
      res.res,
    )

    const lines = setCookieLines(res.headers)
    const shadowLines = lines.filter(
      (line) =>
        line.startsWith(`${fedcmDeviceCookie}=`) ||
        line.startsWith(`${fedcmDeviceCookie}-hash=`) ||
        line.startsWith(`${fedcmSessionCookie}=`) ||
        line.startsWith(`${fedcmSessionCookie}-hash=`),
    )
    expect(shadowLines).toHaveLength(4)
    for (const line of shadowLines) {
      const attributes = line
        .split(';')
        .slice(1)
        .map((attribute) => attribute.trim().toLowerCase())
      expect(attributes).toContain('path=/oauth/fedcm')
      expect(attributes).toContain('httponly')
      expect(attributes).toContain('secure')
      expect(attributes).toContain('samesite=none')
    }

    const shadowHeader = cookieHeader(
      [fedcmDeviceCookie, cookieValue(lines, fedcmDeviceCookie)!],
      [
        `${fedcmDeviceCookie}-hash`,
        cookieValue(lines, `${fedcmDeviceCookie}-hash`)!,
      ],
      [fedcmSessionCookie, cookieValue(lines, fedcmSessionCookie)!],
      [
        `${fedcmSessionCookie}-hash`,
        cookieValue(lines, `${fedcmSessionCookie}-hash`)!,
      ],
    )
    await expect(
      manager.readFedcmDevice(request(shadowHeader)),
    ).resolves.toMatchObject({
      deviceId,
    })
  })

  it('adopts an existing primary session after a successful load without rotation', async () => {
    const { store } = createStore(deviceData())
    const manager = new DeviceManager(store, {}, true)
    const res = response()

    await manager.load(request(primaryCookieHeader()), res.res)

    const lines = setCookieLines(res.headers)
    expect(cookieValue(lines, fedcmDeviceCookie)).toBe(deviceId)
    expect(cookieValue(lines, fedcmSessionCookie)).toBe(sessionId)
    expect(lines.some((line) => line.startsWith('dev-id='))).toBe(false)
    expect(lines.some((line) => line.startsWith('ses-id='))).toBe(false)
    expect(store.createDevice).not.toHaveBeenCalled()
    expect(store.updateDevice).not.toHaveBeenCalled()
    expect(store.deleteDevice).not.toHaveBeenCalled()
  })

  it('authenticates only the exact current shadow pair', async () => {
    const { store } = createStore(deviceData())
    const manager = new DeviceManager(store, {}, true)

    await expect(
      manager.readFedcmDevice(request(fedcmCookieHeader())),
    ).resolves.toEqual({
      deviceId,
      deviceMetadata: { userAgent, ipAddress, port: 1234 },
    })

    const readCount = vi.mocked(store.readDevice).mock.calls.length
    await expect(
      manager.readFedcmDevice(request(primaryCookieHeader())),
    ).resolves.toBeNull()
    expect(store.readDevice).toHaveBeenCalledTimes(readCount)
  })

  it('rejects missing, malformed, stale, and forged cookies without changing device state', async () => {
    const { store } = createStore(deviceData())
    const keys = createKeys()
    const manager = new DeviceManager(store, { cookie: { keys } }, true)
    const signedCookieHeader = (
      id: string,
      session: string,
      deviceHash = keys.sign(id),
      sessionHash = keys.sign(session),
    ) =>
      cookieHeader(
        [fedcmDeviceCookie, id],
        [`${fedcmDeviceCookie}-hash`, deviceHash],
        [fedcmSessionCookie, session],
        [`${fedcmSessionCookie}-hash`, sessionHash],
      )

    const invalidCookies = [
      undefined,
      cookieHeader([fedcmDeviceCookie, deviceId]),
      signedCookieHeader('malformed', sessionId),
      signedCookieHeader(deviceId, staleSessionId),
      signedCookieHeader(deviceId, sessionId, 'forged-signature'),
    ]

    for (const cookie of invalidCookies) {
      await expect(manager.readFedcmDevice(request(cookie))).resolves.toBeNull()
    }

    expect(store.readDevice).toHaveBeenCalledTimes(1)
    expect(store.createDevice).not.toHaveBeenCalled()
    expect(store.updateDevice).not.toHaveBeenCalled()
    expect(store.deleteDevice).not.toHaveBeenCalled()
  })

  it('invalidates a shadow session when the ordinary session rotates', async () => {
    const { store } = createStore(deviceData({ lastSeenAt: new Date(0) }))
    const manager = new DeviceManager(store, { rotationRate: 1 }, true)
    const res = response()

    await manager.load(request(primaryCookieHeader()), res.res)

    const lines = setCookieLines(res.headers)
    const newDeviceCookie = cookieValue(lines, fedcmDeviceCookie)
    const newSessionCookie = cookieValue(lines, fedcmSessionCookie)
    expect(newDeviceCookie).toBe(deviceId)
    expect(newSessionCookie).toBeTruthy()
    expect(newSessionCookie).not.toBe(sessionId)
    expect(
      await manager.readFedcmDevice(request(fedcmCookieHeader())),
    ).toBeNull()
    await expect(
      manager.readFedcmDevice(
        request(
          cookieHeader(
            [fedcmDeviceCookie, newDeviceCookie!],
            [fedcmSessionCookie, newSessionCookie!],
          ),
        ),
      ),
    ).resolves.toMatchObject({ deviceId })
  })
})
