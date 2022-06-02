import { Resolver } from 'did-resolver'
import { getResolver } from 'web-did-resolver'
import { ReadOnlyDidDocAPI } from '../did-documents.js'

const didResolver = new Resolver(getResolver())

export async function resolve(didUri: string): Promise<ReadOnlyDidDocAPI> {
  const res = await didResolver.resolve(didUri)
  if (!res?.didDocument) throw new Error('Not found')
  return new ReadOnlyDidDocAPI(res.didDocument, res.didDocumentMetadata)
}
