import * as ucans from '@ucans/core'
import { p256Plugin } from '@adxp/crypto'
import { ed25519Plugin } from '@ucans/default-plugins'

export const didPlugins = new ucans.Plugins([p256Plugin, ed25519Plugin], {})
