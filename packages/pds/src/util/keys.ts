import {
  KeyObject,
  createPrivateKey,
  createPublicKey,
  createSecretKey,
} from 'node:crypto'
import KeyEncoder from 'key-encoder'

export const createSecretKeyObject = (secret: string): KeyObject => {
  return createSecretKey(Buffer.from(secret))
}

const keyEncoder = new KeyEncoder('secp256k1')
export const createPublicKeyObject = (publicKeyHex: string): KeyObject => {
  const key = keyEncoder.encodePublic(publicKeyHex, 'raw', 'pem')
  return createPublicKey({ format: 'pem', key })
}

export const createPrivateKeyObject = (privateKeyHex: string): KeyObject => {
  const privKeyEncoded = keyEncoder.encodePrivate(privateKeyHex, 'raw', 'pem')
  return createPrivateKey(privKeyEncoded)
}
