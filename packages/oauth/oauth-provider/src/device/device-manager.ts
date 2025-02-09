import { IncomingMessage, ServerResponse } from 'node:http'
import { serialize as serializeCookie } from 'cookie'
import type Keygrip from 'keygrip'
import { z } from 'zod'
import { SESSION_FIXATION_MAX_AGE } from '../constants.js'
import { appendHeader, parseHttpCookies } from '../lib/http/index.js'
import { DeviceData } from './device-data.js'
import { extractDeviceDetails } from './device-details.js'
import { DeviceId, deviceIdSchema, generateDeviceId } from './device-id.js'
import { DeviceStore } from './device-store.js'
import { generateSessionId, sessionIdSchema } from './session-id.js'

export const DEFAULT_OPTIONS = {
  /**
   * Controls whether the IP address is read from the `X-Forwarded-For` header
   * (if `true`), or from the `req.socket.remoteAddress` property (if `false`).
   *
   * @default true // (nowadays, most requests are proxied)
   */
  trustProxy: true,

  /**
   * Amount of time (in ms) after which session IDs will be rotated
   *
   * @default 300e3 // (5 minutes)
   */
  rotationRate: 5 * 60e3,

  /**
   * Cookie options
   */
  cookie: {
    keys: undefined as undefined | Keygrip,

    /**
     * Name of the cookie used to identify the device
     *
     * @default 'session-id'
     */
    device: 'device-id',

    /**
     * Name of the cookie used to identify the session
     *
     * @default 'session-id'
     */
    session: 'session-id',

    /**
     * Url path for the cookie
     *
     * @default '/oauth/authorize'
     */
    path: '/oauth/authorize',

    /**
     * Amount of time (in ms) after which the session cookie will expire.
     * If set to `null`, the cookie will be a session cookie (deleted when the
     * browser is closed).
     *
     * @default 10 * 365.2 * 24 * 60 * 60e3 // 10 years (in ms)
     */
    age: <number | null>(10 * 365.2 * 24 * 60 * 60e3),

    /**
     * Controls whether the cookie is only sent over HTTPS (if `true`), or also
     * over HTTP (if `false`). This should **NOT** be set to `false` in
     * production.
     */
    secure: true,

    /**
     * Controls whether the cookie is sent along with cross-site requests.
     *
     * @default 'lax'
     */
    sameSite: 'lax' as 'lax' | 'strict',
  },
}

export type DeviceDeviceManagerOptions = typeof DEFAULT_OPTIONS

const cookieValueSchema = z.tuple([deviceIdSchema, sessionIdSchema])
type CookieValue = z.infer<typeof cookieValueSchema>

/**
 * This class provides an abstraction for keeping track of DEVICE sessions. It
 * relies on a {@link DeviceStore} to persist session data and a cookie to
 * identify the session.
 */
export class DeviceManager {
  constructor(
    private readonly store: DeviceStore,
    private readonly options: DeviceDeviceManagerOptions = DEFAULT_OPTIONS,
  ) {}

  public async load(
    req: IncomingMessage,
    res: ServerResponse,
    forceRotate = false,
  ): Promise<{ deviceId: DeviceId }> {
    const cookie = await this.getCookie(req)
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
  ): Promise<{ deviceId: DeviceId }> {
    const { userAgent, ipAddress } = this.getDeviceDetails(req)

    const [deviceId, sessionId] = await Promise.all([
      generateDeviceId(),
      generateSessionId(),
    ] as const)

    await this.store.createDevice(deviceId, {
      sessionId,
      lastSeenAt: new Date(),
      userAgent,
      ipAddress,
    })

    this.setCookie(res, [deviceId, sessionId])

    return { deviceId }
  }

  private async refresh(
    req: IncomingMessage,
    res: ServerResponse,
    [deviceId, sessionId]: CookieValue,
    forceRotate = false,
  ): Promise<{ deviceId: DeviceId }> {
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

    const details = this.getDeviceDetails(req)

    if (
      forceRotate ||
      details.ipAddress !== data.ipAddress ||
      details.userAgent !== data.userAgent ||
      age > this.options.rotationRate
    ) {
      await this.rotate(req, res, deviceId, {
        ipAddress: details.ipAddress,
        userAgent: details.userAgent || data.userAgent,
      })
    }

    return { deviceId }
  }

  public async rotate(
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

    this.setCookie(res, [deviceId, sessionId])
  }

  private async getCookie(
    req: IncomingMessage,
  ): Promise<{ value: CookieValue; mustRotate: boolean } | null> {
    const cookies = parseHttpCookies(req)
    if (!cookies) return null

    const device = this.parseCookie(
      cookies,
      this.options.cookie.device,
      deviceIdSchema,
    )
    const session = this.parseCookie(
      cookies,
      this.options.cookie.session,
      sessionIdSchema,
    )

    // Silently ignore invalid cookies
    if (!device || !session) {
      // If the device cookie is valid, let's cleanup the DB
      if (device) await this.store.deleteDevice(device.value)

      return null
    }

    return {
      value: [device.value, session.value],
      mustRotate: device.mustRotate || session.mustRotate,
    }
  }

  private parseCookie<T>(
    cookies: Record<string, string | undefined>,
    name: string,
    schema: z.ZodType<T> | z.ZodEffects<z.ZodTypeAny, T, string>,
  ): null | { value: T; mustRotate: boolean } {
    const result = schema.safeParse(cookies[name], { path: ['cookie', name] })
    if (!result.success) return null

    const value = result.data

    if (this.options.cookie.keys) {
      const hash = cookies[`${name}:hash`]
      if (!hash) return null

      const idx = this.options.cookie.keys.index(value, hash)
      if (idx < 0) return null

      return { value, mustRotate: idx !== 0 }
    }

    return { value, mustRotate: false }
  }

  private setCookie(res: ServerResponse, cookieValue: null | CookieValue) {
    this.writeCookie(res, this.options.cookie.device, cookieValue?.[0])
    this.writeCookie(res, this.options.cookie.session, cookieValue?.[1])
  }

  private writeCookie(res: ServerResponse, name: string, value?: string) {
    const cookieOptions = {
      maxAge: value
        ? this.options.cookie.age == null
          ? undefined
          : this.options.cookie.age / 1000
        : 0,
      httpOnly: true,
      path: this.options.cookie.path,
      secure: this.options.cookie.secure !== false,
      sameSite: this.options.cookie.sameSite === 'lax' ? 'lax' : 'strict',
    } as const

    appendHeader(
      res,
      'Set-Cookie',
      serializeCookie(name, value || '', cookieOptions),
    )

    if (this.options.cookie.keys) {
      appendHeader(
        res,
        'Set-Cookie',
        serializeCookie(
          `${name}:hash`,
          value ? this.options.cookie.keys.sign(value) : '',
          cookieOptions,
        ),
      )
    }
  }

  private getDeviceDetails(req: IncomingMessage) {
    return extractDeviceDetails(req, this.options.trustProxy)
  }
}
