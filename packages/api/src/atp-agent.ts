import { OAuthClient } from '@atproto/oauth-client'
import { AtpClient } from './client'
import { BSKY_LABELER_DID } from './const'
import {
  AtpAgentGlobalOpts,
  AtprotoServiceType,
  ComAtprotoServerXrpcAgentOptionsOpts,
} from './types'
import {
  AuthenticatedXrpcAgent,
  ComAtprotoServerXrpcAgent,
  OAuthXrpcAgent,
  isAuthenticatedXrpcAgent,
} from './xrpc-agent'

const MAX_LABELERS = 10

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

  protected xrpcAgent: AuthenticatedXrpcAgent

  constructor(
    options:
      | AuthenticatedXrpcAgent
      | ComAtprotoServerXrpcAgentOptionsOpts
      | OAuthClient,
  ) {
    this.xrpcAgent = isAuthenticatedXrpcAgent(options)
      ? options
      : options instanceof OAuthClient
        ? new OAuthXrpcAgent(options)
        : new ComAtprotoServerXrpcAgent(options)
    this.api = new AtpClient(this.xrpcAgent)

    this.api.xrpc.setHeader('atproto-accept-labelers', () =>
      // Make sure to read the static property from the subclass if it was
      // overridden.
      (this.constructor as typeof AtpAgent).appLabelers
        .map((str) => `${str};redact`)
        .concat(this.labelersHeader.filter((str) => str.startsWith('did:')))
        .slice(0, MAX_LABELERS)
        .join(', '),
    )
  }

  get xrpc() {
    return this.api.xrpc
  }

  get com() {
    return this.api.com
  }

  async ownDid() {
    return this.xrpcAgent.ownDid()
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
    if (!did.startsWith('did:')) throw new TypeError('Invalid DID')
    this.api.xrpc.setHeader('atproto-proxy', `${did}#${serviceType}`)
  }

  clearProxyHeader() {
    this.api.xrpc.unsetHeader('atproto-proxy')
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
