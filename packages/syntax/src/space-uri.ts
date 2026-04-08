import { DidString, ensureValidDid } from './did.js'
import { NsidString, ensureValidNsid } from './nsid.js'

/**
 * Space URI format:
 * ats://spaceDid/spaceType/skey[/userDid/collection/rkey]
 *
 * First three parts (spaceDid, spaceType, skey) are required.
 * Last three parts (userDid, collection, rkey) are optional.
 */

export type SpaceUriString = `ats://${string}`

const ATS_URI_REGEX = /^(ats:\/\/)?(did:[a-z0-9:%-]+)(\/[^?#\s]*)?$/i

export class SpaceUri {
  spaceDid: DidString
  pathname: string

  constructor(uri: string) {
    const match = uri.match(ATS_URI_REGEX)
    if (!match) {
      throw new Error(`Invalid Space URI: ${uri}`)
    }
    const did = match[2]
    ensureValidDid(did)
    this.spaceDid = did
    this.pathname = match[3] ?? ''
  }

  private get parts(): string[] {
    return this.pathname.split('/').filter(Boolean)
  }

  static make(
    spaceDid: string,
    spaceType: string,
    skey: string,
    userDid?: string,
    collection?: string,
    rkey?: string,
  ) {
    let str = `ats://${spaceDid}/${spaceType}/${skey}`
    if (userDid) str += `/${userDid}`
    if (collection) str += `/${collection}`
    if (rkey) str += `/${rkey}`
    return new SpaceUri(str)
  }

  get protocol() {
    return 'ats:'
  }

  get origin(): `ats://${DidString}` {
    return `ats://${this.spaceDid}`
  }

  // --- Required parts ---

  get spaceType(): string {
    return this.parts[0] ?? ''
  }

  get spaceTypeSafe(): NsidString {
    const val = this.spaceType
    ensureValidNsid(val)
    return val
  }

  get skey(): string {
    return this.parts[1] ?? ''
  }

  /** The space portion of the URI: ats://spaceDid/type/skey */
  get space(): string {
    return `ats://${this.spaceDid}/${this.spaceType}/${this.skey}`
  }

  // --- Optional parts (user/collection/rkey) ---

  get userDid(): string {
    return this.parts[2] ?? ''
  }

  get userDidSafe(): DidString {
    const val = this.userDid
    ensureValidDid(val)
    return val
  }

  get collection(): string {
    return this.parts[3] ?? ''
  }

  get collectionSafe(): NsidString {
    const val = this.collection
    ensureValidNsid(val)
    return val
  }

  get rkey(): string {
    return this.parts[4] ?? ''
  }

  get href() {
    return this.toString()
  }

  toString(): SpaceUriString {
    let path = this.pathname || ''
    if (path && !path.startsWith('/')) {
      path = `/${path}`
    }
    return `ats://${this.spaceDid}${path}`
  }
}
