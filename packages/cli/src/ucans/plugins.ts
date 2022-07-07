import * as ucans from '@ucans/core'
import { p256Plugin } from '@adxp/crypto'

export const didPlugins = new ucans.Plugins([p256Plugin], {})
