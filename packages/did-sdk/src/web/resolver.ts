import {
  ParsedDID,
  DIDResolutionOptions,
  DIDResolutionResult,
  DIDResolver,
  Resolvable,
  DIDDocument,
} from 'did-resolver'
import axios from 'axios'
import * as errors from '../errors'

export const DOC_PATH = '/.well-known/did.json'

export const resolve: DIDResolver = async (
  did: string,
  parsed: ParsedDID,
  _didResolver: Resolvable,
  _options: DIDResolutionOptions,
): Promise<DIDResolutionResult> => {
  if (parsed.method !== 'web') {
    return errors.unsupported()
  }
  const parts = parsed.id.split(':').map(decodeURIComponent)
  let path: string
  if (parts.length < 1) {
    return errors.invalidDid()
  } else if (parts.length === 1) {
    path = parts[0] + DOC_PATH
  } else {
    path = parts.join('/') + '/did.json'
  }

  const url = new URL(`https://${path}`)
  if (url.hostname === 'localhost') {
    url.protocol = 'http'
  }

  let didDocument: DIDDocument
  try {
    didDocument = await get(url.toString())
  } catch (err) {
    // @TODO handle errors better?
    return errors.notFound()
  }

  // TODO: this excludes the use of query params
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

const get = async (url: string, timeout = 5000): Promise<any> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(controller.abort, timeout)

  let res
  try {
    res = await axios.get(url, {
      responseType: 'json',
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
  clearTimeout(timeoutId)

  if (res.status >= 400) {
    throw new Error(`Bad response ${res.statusText}`)
  }
  return res.data
}
