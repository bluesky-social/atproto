import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { parseHttpCookies } from '../lib/http/index.js'
import {
  type RequestMetadata,
  extractRequestMetadata,
  setCookie,
} from '../lib/http/request.js'
import { SESSION_FIXATION_MAX_AGE } from '../oauth-constants.js'
import type { DeviceData } from './device-data.js'
import { type DeviceId, deviceIdSchema, generateDeviceId } from './device-id.js'
import type { DeviceStore } from './device-store.js'
import { generateSessionId, sessionIdSchema } from './session-id.js'

/**
 * @see {@link https://www.npmjs.com/package/keygrip | Keygrip}
 */
export const keygripSchema = z.object({
  sign: z.function().args(z.any()).returns(z.string()),
  verify: z.function().args(z.any(), z.string()).returns(z.boolean()),
  index: z.function().args(z.any(), z.string()).returns(z.number()),
})

export const deviceManagerOptionsSchema = z.object({
  /**
   * Controls whether the IP address is read from the `X-Forwarded-For` header
   * (if `true`), or from the `req.socket.remoteAddress` property (if `false`).
   */
  trustProxy: z
    .function()
    .args<[addr: z.ZodString, i: z.ZodNumber]>(z.string(), z.number())
    .returns(z.boolean())
    .optional(),

  /**
   * Amount of time (in ms) after which session IDs will be rotated
   *
   * @default 300e3 // (5 minutes)
   */
  rotationRate: z.number().default(300e3),
  /**
   * Cookie options
   */
  cookie: z
    .object({
      keys: keygripSchema.optional(),
      /**
       * Amount of time (in ms) after which the session cookie will expire.
       * If set to `null`, the cookie will be a session cookie (deleted when the
       * browser is closed).
       *
       * @default 10 years
       */
      age: z
        .number()
        .nullable()
        .default(10 * 365.2 * 24 * 60 * 60e3),
      /**
       * Controls whether the cookie is only sent over HTTPS (if `true`), or also
       * over HTTP (if `false`). This should **NOT** be set to `false` in
       * production.
       */
      secure: z.boolean().default(true),
      /**
       * Controls whether the cookie is sent along with cross-site requests.
       *
       * @default 'lax'
       */
      sameSite: z.enum(['lax', 'strict']).default('lax'),
    })
    .default({}),
})

export type DeviceManagerOptions = z.input<typeof deviceManagerOptionsSchema>

type CookieValue = {
  deviceId: DeviceId
  sessionId: string
}

// @NOTE FedCM sends only SameSite=None cookies; ordinary cookies stay Lax/Strict.
const FEDCM_DEVICE_COOKIE = '__Secure-atproto-fedcm-device'
const FEDCM_SESSION_COOKIE = '__Secure-atproto-fedcm-session'
const FEDCM_COOKIE_PATH = '/oauth/fedcm'

function cookieHashName(name: string) {
  return `${name}-hash`
}

export type DeviceInfo = {
  deviceId: DeviceId
  deviceMetadata: RequestMetadata
}

/**
 * This class provides an abstraction for keeping track of DEVICE sessions. It
 * relies on a {@link DeviceStore} to persist session data and a cookie to
 * identify the session.
 */
export class DeviceManager {
  private readonly options: z.output<typeof deviceManagerOptionsSchema>

  constructor(
    private readonly store: DeviceStore,
    options: DeviceManagerOptions = {},
    private readonly fedcmEnabled = false,
  ) {
    this.options = deviceManagerOptionsSchema.parse(options)
  }

  public async hasSession(req: IncomingMessage): Promise<boolean> {
    const cookies = await this.getCookies(req)
    return cookies !== null
  }

  /**
   * Reads the FedCM shadow session without changing device state or renewing
   * either cookie.
   */
  public async readFedcmDevice(
    req: IncomingMessage,
  ): Promise<DeviceInfo | null> {
    if (!this.fedcmEnabled) return null

    const cookie = this.getFedcmCookies(req)
    if (!cookie) return null

    const data = await this.store.readDevice(cookie.deviceId)
    if (!data || data.sessionId !== cookie.sessionId) return null

    return {
      deviceId: cookie.deviceId,
      deviceMetadata: this.getRequestMetadata(req),
    }
  }

  public async load(
    req: IncomingMessage,
    res: ServerResponse,
    forceRotate = false,
  ): Promise<DeviceInfo> {
    const cookie = await this.getCookies(req)
    if (cookie) {
      return this.refresh(
        req,
        res,
        cookie.value,
        forceRotate || cookie.mustRotate,
      )
    } else {
      return this.create(req, res)
    }
  }

  private async create(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<DeviceInfo> {
    const deviceMetadata = this.getRequestMetadata(req)

    const [deviceId, sessionId] = await Promise.all([
      generateDeviceId(),
      generateSessionId(),
    ] as const)

    await this.store.createDevice(deviceId, {
      sessionId,
      lastSeenAt: new Date(),
      userAgent: deviceMetadata.userAgent ?? null,
      ipAddress: deviceMetadata.ipAddress,
    })

    await this.setCookies(req, res, { deviceId, sessionId })

    return { deviceId, deviceMetadata }
  }

  private async refresh(
    req: IncomingMessage,
    res: ServerResponse,
    { deviceId, sessionId }: CookieValue,
    forceRotate = false,
  ): Promise<DeviceInfo> {
    const data = await this.store.readDevice(deviceId)
    if (!data) return this.create(req, res)

    const lastSeenAt = new Date(data.lastSeenAt)
    const age = Date.now() - lastSeenAt.getTime()

    if (sessionId !== data.sessionId) {
      if (age <= SESSION_FIXATION_MAX_AGE) {
        // The cookie was probably rotated by a concurrent request. Let's
        // update the cookie with the new sessionId.
        forceRotate = true
      } else {
        // Something's wrong. Let's create a new session.
        await this.store.deleteDevice(deviceId)
        return this.create(req, res)
      }
    }

    const deviceMetadata = this.getRequestMetadata(req)

    const shouldRotate =
      forceRotate ||
      deviceMetadata.ipAddress !== data.ipAddress ||
      deviceMetadata.userAgent !== data.userAgent ||
      age > this.options.rotationRate

    if (shouldRotate) {
      await this.rotate(req, res, deviceId, {
        ipAddress: deviceMetadata.ipAddress,
        userAgent: deviceMetadata.userAgent || data.userAgent,
      })
    } else if (this.fedcmEnabled) {
      this.writeFedcmCookies(res, {
        deviceId,
        sessionId: data.sessionId,
      })
    }

    return { deviceId, deviceMetadata }
  }

  private async rotate(
    req: IncomingMessage,
    res: ServerResponse,
    deviceId: DeviceId,
    data?: Partial<Omit<DeviceData, 'sessionId' | 'lastSeenAt'>>,
  ): Promise<void> {
    const sessionId = await generateSessionId()

    await this.store.updateDevice(deviceId, {
      ...data,
      sessionId,
      lastSeenAt: new Date(),
    })

    await this.setCookies(req, res, { deviceId, sessionId })
  }

  private async getCookies(
    req: IncomingMessage,
  ): Promise<{ value: CookieValue; mustRotate: boolean } | null> {
    const cookies = parseHttpCookies(req)

    const device = this.parseCookie(cookies, `dev-id`, deviceIdSchema)
    const session = this.parseCookie(cookies, `ses-id`, sessionIdSchema)

    const deviceId = device?.value
    const sessionId = session?.value

    // Silently ignore invalid cookies
    if (!deviceId || !sessionId) {
      // If the device cookie is still present, let's cleanup the DB
      if (deviceId) await this.store.deleteDevice(deviceId)

      return null
    }

    return {
      value: { deviceId, sessionId },
      mustRotate: device.mustRotate || session.mustRotate,
    }
  }

  private getFedcmCookies(req: IncomingMessage): CookieValue | null {
    const cookies = parseHttpCookies(req)

    const device = this.parseCookie(
      cookies,
      FEDCM_DEVICE_COOKIE,
      deviceIdSchema,
      cookieHashName(FEDCM_DEVICE_COOKIE),
    )
    const session = this.parseCookie(
      cookies,
      FEDCM_SESSION_COOKIE,
      sessionIdSchema,
      cookieHashName(FEDCM_SESSION_COOKIE),
    )

    if (!device || !session) return null

    return { deviceId: device.value, sessionId: session.value }
  }

  private parseCookie<T>(
    cookies: Record<string, string | undefined>,
    name: string,
    schema: z.ZodType<T> | z.ZodEffects<z.ZodTypeAny, T, string>,
    hashName = `${name}:hash`,
  ): null | { value: T; mustRotate: boolean } {
    const rawValue = Object.hasOwn(cookies, name) ? cookies[name] : null
    if (!rawValue) return null

    const result = schema.safeParse(rawValue)
    if (!result.success) return null

    const value = result.data

    if (this.options.cookie.keys) {
      const hash = Object.hasOwn(cookies, hashName) ? cookies[hashName] : null
      if (!hash) return null

      const idx = this.options.cookie.keys.index(rawValue, hash)
      if (idx < 0) return null

      return { value, mustRotate: idx !== 0 }
    }

    return { value, mustRotate: false }
  }

  private async setCookies(
    req: IncomingMessage,
    res: ServerResponse,
    { deviceId, sessionId }: CookieValue,
  ) {
    this.writeCookie(res, `dev-id`, deviceId)
    this.writeCookie(res, `ses-id`, sessionId)

    if (this.fedcmEnabled) {
      this.writeFedcmCookies(res, { deviceId, sessionId })
    }
  }

  private writeFedcmCookies(
    res: ServerResponse,
    { deviceId, sessionId }: CookieValue,
  ) {
    this.writeFedcmCookie(res, FEDCM_DEVICE_COOKIE, deviceId)
    this.writeFedcmCookie(res, FEDCM_SESSION_COOKIE, sessionId)
  }

  private writeFedcmCookie(res: ServerResponse, name: string, value: string) {
    const cookieOptions = {
      maxAge:
        this.options.cookie.age == null
          ? undefined
          : this.options.cookie.age / 1000,
      httpOnly: true,
      path: FEDCM_COOKIE_PATH,
      secure: true,
      sameSite: 'none',
    } as const

    setCookie(res, name, value, cookieOptions)

    if (this.options.cookie.keys) {
      const hash = this.options.cookie.keys.sign(value)
      setCookie(res, cookieHashName(name), hash, cookieOptions)
    }
  }

  private writeCookie(res: ServerResponse, name: string, value?: string) {
    const cookieOptions = {
      maxAge: value
        ? this.options.cookie.age == null
          ? undefined
          : this.options.cookie.age / 1000
        : 0,
      httpOnly: true,
      path: '/',
      secure: this.options.cookie.secure !== false,
      sameSite: this.options.cookie.sameSite,
    } as const

    setCookie(res, name, value || '', cookieOptions)

    if (this.options.cookie.keys) {
      const hash = value ? this.options.cookie.keys.sign(value) : ''
      setCookie(res, `${name}:hash`, hash, cookieOptions)
    }
  }

  public getRequestMetadata(req: IncomingMessage) {
    return extractRequestMetadata(req, this.options)
  }
}
