import { OAuthClient } from '@atproto/oauth-client'
import { AtpClient } from './client'
import { BSKY_LABELER_DID } from './const'
import { SessionManager, isSessionManager } from './session/session-manager'
import {
  StatelessSessionManager,
  StatelessSessionManagerOptions,
} from './session/stateless-session-handler'
import { AtpAgentGlobalOpts, AtprotoServiceType } from './types'
import { OAuthSessionManager } from './dispatcher/oauth-dispatcher'

const MAX_LABELERS = 10

export type AtpAgentOptions =
  | SessionManager
  | OAuthClient
  | StatelessSessionManagerOptions

export class AtpAgent {
  /**
   * The labelers to be used across all requests with the takedown capability
   */
  static appLabelers: readonly string[] = [BSKY_LABELER_DID]

  /**
   * Configures the AtpAgent globally.
   */
  static configure(opts: AtpAgentGlobalOpts) {
    if (opts.appLabelers) {
      this.appLabelers = [...opts.appLabelers]
    }
  }

  api: AtpClient
  labelersHeader: string[] = []
  proxyHeader?: string

  readonly sessionManager: SessionManager

  get com() {
    return this.api.com
  }

  constructor(options: AtpAgentOptions) {
    this.sessionManager = isSessionManager(options)
      ? options
      : options instanceof OAuthClient
        ? new OAuthSessionManager(options)
        : new StatelessSessionManager(options)

    this.api = new AtpClient((...args) =>
      // The function needs to be "bound" to the right context
      this.sessionManager.fetchHandler(...args),
    )
    this.api.setHeader('atproto-accept-labelers', () =>
      // Make sure to read the static property from the subclass in case it was
      // overridden.
      (this.constructor as typeof AtpAgent).appLabelers
        .map((str) => `${str};redact`)
        .concat(this.labelersHeader.filter((str) => str.startsWith('did:')))
        .slice(0, MAX_LABELERS)
        .join(', '),
    )
    this.api.setHeader('atproto-proxy', () => this.proxyHeader)
  }

  clone() {
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
    return inst
  }

  /** @deprecated only used for a very particular use-case in the official Bluesky app */
  async getServiceUrl(): Promise<URL> {
    return this.sessionManager.getServiceUrl()
  }

  /**
   * Get the active session's DID
   */
  async getDid(): Promise<string> {
    return this.sessionManager.getDid()
  }

  /**
   * Configures the moderation services to be applied on requests.
   * NOTE: this is called automatically by getPreferences() and the relevant moderation config
   * methods in BskyAgent instances.
   */
  configureLabelersHeader(labelerDids: string[]) {
    this.labelersHeader = labelerDids
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
  uploadBlob: typeof this.api.com.atproto.repo.uploadBlob = (data, opts) =>
    this.api.com.atproto.repo.uploadBlob(data, opts)

  /**
   * Resolve a handle to a DID
   */
  resolveHandle: typeof this.api.com.atproto.identity.resolveHandle = (
    params,
    opts,
  ) => this.api.com.atproto.identity.resolveHandle(params, opts)

  /**
   * Change the user's handle
   */
  updateHandle: typeof this.api.com.atproto.identity.updateHandle = (
    data,
    opts,
  ) => this.api.com.atproto.identity.updateHandle(data, opts)

  /**
   * Create a moderation report
   */
  createModerationReport: typeof this.api.com.atproto.moderation.createReport =
    (data, opts) => this.api.com.atproto.moderation.createReport(data, opts)
}
