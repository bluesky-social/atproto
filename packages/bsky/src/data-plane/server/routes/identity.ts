import { Timestamp } from '@bufbuild/protobuf'
import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { DidDocument, IdResolver, getDid, getHandle } from '@atproto/identity'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'

export default (
  _db: Database,
  idResolver: IdResolver,
): Partial<ServiceImpl<typeof Service>> => ({
  async getIdentityByDid(req) {
    const doc = await idResolver.did.resolve(req.did)
    if (!doc) {
      throw new ConnectError('identity not found', Code.NotFound)
    }
    return getResultFromDoc(doc)
  },

  async getIdentityByHandle(req) {
    const did = await idResolver.handle.resolve(req.handle)
    if (!did) {
      throw new ConnectError('identity not found', Code.NotFound)
    }
    const doc = await idResolver.did.resolve(did)
    if (!doc || did !== getDid(doc)) {
      throw new ConnectError('identity not found', Code.NotFound)
    }
    return getResultFromDoc(doc)
  },
})

const getResultFromDoc = (doc: DidDocument) => {
  const keys: Record<string, { Type: string; PublicKeyMultibase: string }> = {}
  doc.verificationMethod?.forEach((method) => {
    const id = method.id.split('#').at(1)
    if (!id) return
    keys[id] = {
      Type: method.type,
      PublicKeyMultibase: method.publicKeyMultibase || '',
    }
  })
  const services: Record<string, { Type: string; URL: string }> = {}
  doc.service?.forEach((service) => {
    const id = service.id.split('#').at(1)
    if (!id) return
    if (typeof service.serviceEndpoint !== 'string') return
    services[id] = {
      Type: service.type,
      URL: service.serviceEndpoint,
    }
  })
  return {
    did: getDid(doc),
    handle: getHandle(doc),
    keys: Buffer.from(JSON.stringify(keys)),
    services: Buffer.from(JSON.stringify(services)),
    updated: Timestamp.fromDate(new Date()),
  }
}
