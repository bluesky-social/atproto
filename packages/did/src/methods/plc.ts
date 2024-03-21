import {
  Fetch,
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
} from '@atproto/fetch'
import { compose } from '@atproto/transformer'

import { didDocumentValidator } from '../did-document.js'
import { InvalidDidError } from '../did-error.js'
import { DidMethod, ResolveOptions } from '../did-method.js'
import { Did } from '../did.js'

const DID_PLC_PREFIX = `did:plc:`
const DID_PLC_PREFIX_LENGTH = DID_PLC_PREFIX.length
const DID_PLC_LENGTH = 32

export { DID_PLC_PREFIX }

export function checkDidPlc(input: string) {
  if (input.length !== DID_PLC_LENGTH) {
    throw new InvalidDidError(
      input,
      `did:plc must be ${DID_PLC_LENGTH} characters long`,
    )
  }

  if (!input.startsWith(DID_PLC_PREFIX)) {
    throw new InvalidDidError(input, `Invalid did:plc prefix`)
  }

  let c: number
  for (let i = DID_PLC_PREFIX_LENGTH; i < DID_PLC_LENGTH; i++) {
    c = input.charCodeAt(i)
    // Base32 encoding ([a-z2-7])
    if ((c < 0x61 || c > 0x7a) && (c < 0x32 || c > 0x37)) {
      throw new InvalidDidError(input, `Invalid character at position ${i}`)
    }
  }
}

const didWebDocumentTransformer = compose(
  fetchOkProcessor(),
  fetchJsonProcessor(/^application\/(did\+ld\+)?json$/),
  fetchJsonZodProcessor(didDocumentValidator),
)

export type DidPlcMethodOptions = {
  plcDirectoryUrl?: string | URL
  fetch?: Fetch
}

export class DidPlcMethod implements DidMethod<'plc'> {
  readonly plcDirectoryUrl: URL
  protected readonly fetch: Fetch

  constructor({
    plcDirectoryUrl = 'https://plc.directory/',
    fetch = globalThis.fetch,
  }: DidPlcMethodOptions = {}) {
    this.plcDirectoryUrl = new URL(plcDirectoryUrl)
    this.fetch = fetch
  }

  async resolve(did: Did<'plc'>, options?: ResolveOptions) {
    checkDidPlc(did)

    const url = new URL(`/${did}`, this.plcDirectoryUrl)

    const request = new Request(url, {
      redirect: 'error',
      headers: { accept: 'application/did+ld+json,application/json' },
      signal: options?.signal,
    })

    return this.fetch
      .call(globalThis, request)
      .then(didWebDocumentTransformer, fetchFailureHandler)
  }
}
