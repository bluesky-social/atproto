// import { parse } from 'did-resolver'
import * as didKey from '@transmute/did-key.js'
import { ReadOnlyDidDocAPI } from '../did-documents.js'

export async function resolve(didUri: string): Promise<ReadOnlyDidDocAPI> {
  const doc = await didKey.resolve(didUri, {
    accept: 'application/did+ld+json',
  })
  return new ReadOnlyDidDocAPI(doc.didDocument)
}
