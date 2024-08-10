import { FetchHandler } from '@atproto/xrpc'
import { AtpBaseClient } from './client/index'
import { BSKY_LABELER_DID } from './const'
import { AtpAgentGlobalOpts, AtprotoServiceType } from './types'
import { asDid, Did, isDid } from './util'

export type { FetchHandler }

/**
 * An {@link AtpClient} is an {@link AtpBaseClient} with the following
 * additional features:
 * - Cloning utilities
 * - AT Protocol labelers configuration utilities
 * - AT Protocol proxy configuration utilities
 */
export class AtpClient extends AtpBaseClient {
  //#region Static configuration

  /**
   * The labelers to be used across all requests with the takedown capability
   */
  static appLabelers: readonly string[] = [BSKY_LABELER_DID]

  /**
   * Configures the Agent (or its sub classes) globally.
   */
  static configure(opts: AtpAgentGlobalOpts) {
    if (opts.appLabelers) {
      this.appLabelers = opts.appLabelers.map(asDid) // Validate & copy
    }
  }

  //#endregion

  #fetchHandler: FetchHandler
  constructor(fetchHandler: FetchHandler) {
    super((url, init) => {
      const headers = new Headers(init?.headers)

      if (this.proxy && !headers.has('atproto-proxy')) {
        headers.set('atproto-proxy', this.proxy)
      }

      // Merge the labelers header of this particular request with the app &
      // instance labelers.
      headers.set(
        'atproto-accept-labelers',
        [
          ...this.appLabelers.map((l) => `${l};redact`),
          ...this.labelers,
          headers.get('atproto-accept-labelers')?.trim(),
        ]
          .filter(Boolean)
          .join(', '),
      )

      return fetchHandler(url, { ...init, headers })
    })

    // #Keep the original fetchHandler for cloning purposes
    this.#fetchHandler = fetchHandler
  }

  //#region Cloning utilities

  clone(): this {
    if (this.constructor === AtpClient) {
      const client = new AtpClient(this.#fetchHandler)
      return this.copyInto(client as this)
    }

    // sub-classes should override this method
    throw new TypeError('Cannot clone a subclass of AtpClient')
  }

  copyInto<T extends AtpClient>(inst: T): T {
    inst.configureLabelers(this.labelers)
    inst.configureProxy(this.proxy ?? null)
    return inst
  }

  withProxy(serviceType: AtprotoServiceType, did: string) {
    if (!isDid(did)) throw new TypeError('Invalid proxy DID')
    const inst = this.clone()
    inst.configureProxy(`${did}#${serviceType}`)
    return inst as ReturnType<this['clone']>
  }

  //#endregion

  //#region ATPROTO labelers configuration utilities

  /**
   * The labelers statically configured on the class of the current instance.
   */
  get appLabelers() {
    const Klass = this.constructor as typeof AtpClient
    return Klass.appLabelers
  }

  labelers: readonly string[] = []

  configureLabelers(labelerDids: readonly string[]) {
    this.labelers = labelerDids.map(asDid) // Validate & copy
  }

  /** @deprecated use {@link configureLabelers} instead */
  configureLabelersHeader(labelerDids: readonly string[]) {
    // Filtering non-did values for backwards compatibility
    this.configureLabelers(labelerDids.filter(isDid))
  }

  //#endregion

  //#region ATPROTO proxy configuration utilities

  proxy?: `${Did}#${AtprotoServiceType}`

  configureProxy(value: `${Did}#${AtprotoServiceType}` | null) {
    if (value === null) this.proxy = undefined
    else if (isDid(value)) this.proxy = value
    else throw new TypeError('Invalid proxy DID')
  }

  /** @deprecated use {@link configureProxy} instead */
  configureProxyHeader(serviceType: AtprotoServiceType, did: string) {
    // Ignoring non-did values for backwards compatibility
    if (isDid(did)) this.configureProxy(`${did}#${serviceType}`)
  }

  //#endregion
}
