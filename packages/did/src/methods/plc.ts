import {
  Fetch,
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchOkProcessor,
  fetchJsonZodProcessor,
} from '@atproto/fetch'
import { compose } from '@atproto/transformer'
import { z } from 'zod'

import { didDocumentValidator } from '../did-document.js'
import { DidMethod, ResolveOptions } from '../did-method.js'
import { Did, didSchema } from '../did.js'
import { InvalidDidError } from '../did-error.js'

const DID_PLC_PREFIX = `did:plc:`
const DID_PLC_PREFIX_LENGTH = DID_PLC_PREFIX.length
const DID_PLC_LENGTH = 32

export { DID_PLC_PREFIX }

export function isDidPlc(input: string): input is Did<'plc'> {
  if (input.length !== DID_PLC_LENGTH) return false

  let i: number
  for (i = 0; i < DID_PLC_PREFIX_LENGTH; i++) {
    if (input.charCodeAt(i) !== DID_PLC_PREFIX.charCodeAt(i)) {
      return false
    }
  }

  let c: number
  for (i = DID_PLC_PREFIX_LENGTH; i < DID_PLC_LENGTH; i++) {
    c = input.charCodeAt(i)
    // Base32 encoding ([a-z2-7])
    if ((c < 0x61 || c > 0x7a) && (c < 0x32 || c > 0x37)) {
      return false
    }
  }

  return true
}

export const didPlcSchema = didSchema.refinement(isDidPlc, {
  code: z.ZodIssueCode.custom,
  message: 'Invalid Web DID',
})

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
    // Avoid un-necessary network traffic if we can
    if (!isDidPlc(did)) {
      throw new InvalidDidError(did, `Invalid did:plc format`)
    }

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
