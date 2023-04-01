import {
  ParsedDID,
  DIDResolutionOptions,
  DIDResolutionResult,
  DIDResolver,
  Resolvable,
  DIDDocument,
} from 'did-resolver'
import axios, { AxiosError } from 'axios'
import * as errors from './errors'

export type PlcResolverOptions = {
  timeout: number
  plcUrl: string
}

export const makeResolver = (opts: PlcResolverOptions): DIDResolver => {
  return async (
    did: string,
    parsed: ParsedDID,
    _didResolver: Resolvable,
    _options: DIDResolutionOptions,
  ): Promise<DIDResolutionResult> => {
    if (parsed.method !== 'plc') {
      return errors.unsupported()
    }

    let didDocument: DIDDocument
    try {
      const res = await axios.get(`${opts.plcUrl}/${encodeURIComponent(did)}`, {
        timeout: opts.timeout,
      })
      didDocument = res.data
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        return errors.notFound() // Positively not found, versus due to e.g. network error
      }
      throw err
    }

    const docIdMatchesDid = didDocument?.id === did
    if (!docIdMatchesDid) {
      return errors.invalidDid()
    }

    return {
      didResolutionMetadata: { contentType: 'application/did+ld+json' },
      didDocument,
      didDocumentMetadata: {},
    }
  }
}
