import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { SESSION_FIXATION_MAX_AGE } from '../constants.js'
import { parseHttpCookies } from '../lib/http/index.js'
import {
  RequestMetadata,
  extractRequestMetadata,
  setCookie,
} from '../lib/http/request.js'
import { DeviceData } from './device-data.js'
import {
  DeviceId,
  deviceIdSchema,
  generateDeviceId,
  isDeviceId,
} from './device-id.js'
import { DeviceStore } from './device-store.js'
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
  private readonly options: z.infer<typeof deviceManagerOptionsSchema>

  constructor(
    private readonly store: DeviceStore,
    options: DeviceManagerOptions = {},
  ) {
    this.options = deviceManagerOptionsSchema.parse(options)
  }

  public async load(
    req: IncomingMessage,
    res: ServerResponse,
    forceRotate = false,
  ): Promise<DeviceInfo> {
    const cookie = await this.getCookies(req, res)
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

    if (
      forceRotate ||
      deviceMetadata.ipAddress !== data.ipAddress ||
      deviceMetadata.userAgent !== data.userAgent ||
      age > this.options.rotationRate
    ) {
      await this.rotate(req, res, deviceId, {
        ipAddress: deviceMetadata.ipAddress,
        userAgent: deviceMetadata.userAgent || data.userAgent,
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
    res: ServerResponse,
  ): Promise<{ value: CookieValue; mustRotate: boolean } | null> {
    const cookies = parseHttpCookies(req)

    // Old cookies were set for the "/oauth/authorize" path while new cookies
    // need to be set for the "/" path (in order to be valid on the api,
    // authorization page and account page). This means that if a user has both
    // cookies set, the browser would use the old cookie for the
    // "/oauth/authorize" path and the new cookie for all other paths. Because
    // of this, different "phantom" sessions would be created for the same
    // device. To avoid this, we needed to change the cookie name. We can still
    // attempt to read the old cookie in order to carry over the session from
    // the "/oauth/authorize" path to the "/" path. This will only work if the
    // user visits the "/oauth/authorize" path first.

    const device =
      this.parseCookie(cookies, `dev-id`, deviceIdSchema) ||
      this.parseCookie(cookies, 'device-id', deviceIdSchema)
    const session =
      this.parseCookie(cookies, `ses-id`, sessionIdSchema) ||
      this.parseCookie(cookies, 'session-id', sessionIdSchema)

    const deviceId = device?.value
    const sessionId = session?.value

    // Clear the legacy cookies, if they are set.
    if (isDeviceId(cookies['device-id']) && cookies['device-id'] !== deviceId) {
      await this.store.deleteDevice(cookies['device-id'])
    }
    if (cookies['device-id'] || cookies['session-id']) {
      const options = { path: '/oauth/authorize', maxAge: 0 } as const
      setCookie(res, 'device-id', '', options)
      setCookie(res, 'session-id', '', options)
    }

    // Silently ignore invalid cookies
    if (!deviceId || !sessionId) {
      // If the device cookie is valid, let's cleanup the DB
      if (deviceId) await this.store.deleteDevice(deviceId)

      return null
    }

    return {
      value: { deviceId, sessionId },
      mustRotate: device.mustRotate || session.mustRotate,
    }
  }

  private parseCookie<T>(
    cookies: Record<string, string | undefined>,
    name: string,
    schema: z.ZodType<T> | z.ZodEffects<z.ZodTypeAny, T, string>,
  ): null | { value: T; mustRotate: boolean } {
    const rawValue = Object.hasOwn(cookies, name) ? cookies[name] : null
    if (!rawValue) return null

    const result = schema.safeParse(rawValue)
    if (!result.success) return null

    const value = result.data

    if (this.options.cookie.keys) {
      const hashName = `${name}:hash`

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
