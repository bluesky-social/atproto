import { ed25519Plugin } from './ed25519/plugin'
import { p256Plugin } from './p256/plugin'
import { secp256k1Plugin } from './secp256k1/plugin'

export const plugins = [ed25519Plugin, p256Plugin, secp256k1Plugin]
