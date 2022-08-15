import { Magic } from 'magic-sdk'
import { Ed25519Extension } from '@magic-ext/ed25519'
import { DidableKey } from '@adxp/auth'

export const magic = new Magic('pk_live_A5578F305BDD6493', {
  extensions: [new Ed25519Extension()],
})

export const getMagicKeypair = async (): Promise<DidableKey | null> => {
  const isLoggedIn = await magic.user.isLoggedIn()
  if (!isLoggedIn) return null
  const did = await magic.ed.getPublicKey()
  return {
    sign: (data: Uint8Array): Promise<Uint8Array> => {
      return magic.ed.sign(data)
    },
    did: (): string => {
      return did
    },
    jwtAlg: 'EdDSA',
  }
}

export default magic
