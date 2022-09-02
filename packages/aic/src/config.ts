import { JsonWebKey } from 'crypto'

export const dbLoc = 'adx.sqlite'
export const port = 26979
export const defaultConsortiumJwk: JsonWebKey = {
  // did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh
  key_ops: ['sign'],
  ext: true,
  kty: 'EC',
  x: 'zn_OWx4zJM5zy8E_WUAJH9OS75K5t6q74D7lMf7AmnQ',
  y: 'trzc_f9i_nOuYRCLMyXxBcpc3OVlylmxdESQ0zdKHeQ',
  crv: 'P-256',
  d: 'Ii__doqqQ5YYZLfKh-LSh1Vm6AqCWHGMrBTDYKaEWfU',
}
