import { OAuthAgent } from '@atproto/oauth-client'
import { AtpClient } from './client'
import { BSKY_LABELER_DID } from './const'
import {
  CustomSessionManager,
  CustomSessionManagerOptions,
} from './session/custom-session-handler'
import { OAuthSessionManager } from './session/oauth-session-manager'
import { SessionManager } from './session/session-manager'
import { AtpAgentGlobalOpts, AtprotoServiceType } from './types'
import { trim } from './util'

export type AtpAgentOptions =
  | SessionManager
  | OAuthAgent
  | CustomSessionManagerOptions

export class AtpAgent {
  /**
   * The labelers to be used across all requests with the takedown capability
   */
  static appLabelers: readonly string[] = [BSKY_LABELER_DID]
  static get labelersHeader() {
    return this.appLabelers.map((str) => `${str};redact`)
  }

  /**
   * Configures the AtpAgent globally.
   */
  static configure(opts: AtpAgentGlobalOpts) {
    if (opts.appLabelers) {
      this.appLabelers = [...opts.appLabelers]
    }
  }

  readonly sessionManager: SessionManager
  readonly api: AtpClient

  protected proxyHeader?: string
  protected labelersHeader: readonly string[] = []

  get com() {
    return this.api.com
  }

  constructor(options: AtpAgentOptions) {
    this.sessionManager =
      options instanceof SessionManager
        ? options
        : options instanceof OAuthAgent
          ? new OAuthSessionManager(options)
          : new CustomSessionManager(options)

    this.api = new AtpClient((url, init) =>
      this.sessionManager.fetchHandler(url, init),
    )

    this.api.setHeader('atproto-proxy', () => this.proxyHeader ?? null)
    this.api.setHeader('atproto-accept-labelers', (reqLabelers) =>
      [
        // Make sure to read the static property from the subclass
        ...(this.constructor as typeof AtpAgent).labelersHeader,
        ...this.labelersHeader,
        ...(reqLabelers?.split(',').map(trim) ?? []),
      ].join(', '),
    )
  }

  clone(): AtpAgent {
    const inst = new AtpAgent(this.sessionManager)
    this.copyInto(inst)
    return inst
  }

  copyInto(inst: AtpAgent) {
    inst.labelersHeader = this.labelersHeader
    inst.proxyHeader = this.proxyHeader
  }

  withProxy(serviceType: AtprotoServiceType, did: string) {
    const inst = this.clone()
    inst.configureProxyHeader(serviceType, did)
    return inst as ReturnType<this['clone']>
  }

  /** @deprecated only used for a very particular use-case in the official Bluesky app */
  async getServiceUrl(): Promise<URL> {
    return this.sessionManager.getServiceUrl()
  }

  /**
   * Get the authenticated user's DID, if any.
   */
  get did() {
    return this.sessionManager.did
  }

  /**
   * Get the authenticated user's DID, or throw an error if not authenticated.
   */
  getDid() {
    const { did } = this
    if (did) return did

    throw new Error('Not logged in')
  }

  /**
   * Assert that the user is authenticated. This method exists mainly for code
   * clarity and is equivalent to calling getDid().
   */
  assertAuthenticated() {
    void this.getDid()
  }

  /**
   * Configures the moderation services to be applied on requests.
   * NOTE: this is called automatically by getPreferences() and the relevant moderation config
   * methods in BskyAgent instances.
   */
  configureLabelersHeader(labelerDids: readonly string[]) {
    this.labelersHeader = labelerDids.filter((str) => str.startsWith('did:'))
  }

  /**
   * Configures the atproto-proxy header to be applied on requests
   */
  configureProxyHeader(serviceType: AtprotoServiceType, did: string) {
    if (did.startsWith('did:')) {
      this.proxyHeader = `${did}#${serviceType}`
    }
  }

  /**
   * Upload a binary blob to the server
   */
  uploadBlob: typeof this.com.atproto.repo.uploadBlob = (data, opts) =>
    this.com.atproto.repo.uploadBlob(data, opts)

  /**
   * Resolve a handle to a DID
   */
  resolveHandle: typeof this.com.atproto.identity.resolveHandle = (
    params,
    opts,
  ) => this.com.atproto.identity.resolveHandle(params, opts)

  /**
   * Change the user's handle
   */
  updateHandle: typeof this.com.atproto.identity.updateHandle = (data, opts) =>
    this.com.atproto.identity.updateHandle(data, opts)

  /**
   * Create a moderation report
   */
  createModerationReport: typeof this.com.atproto.moderation.createReport = (
    data,
    opts,
  ) => this.com.atproto.moderation.createReport(data, opts)
}
