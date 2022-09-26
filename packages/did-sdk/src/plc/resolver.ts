import axios from 'axios'
import {
  ParsedDID,
  DIDResolutionOptions,
  DIDResolutionResult,
  DIDResolver,
  Resolvable,
  DIDDocument,
} from 'did-resolver'
import * as errors from '../errors'

const PLC_URL = 'http://localhost:2582'

export const resolve: DIDResolver = async (
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
    const res = await axios.get(`${PLC_URL}/${did}`)
    didDocument = res.data
  } catch (err) {
    return errors.notFound()
  }

  return {
    didResolutionMetadata: { contentType: 'application/did+ld+json' },
    didDocument,
    didDocumentMetadata: {},
  }
}
