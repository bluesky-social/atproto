import { rebuildRepo } from './rebuild-repo'
import { sequencerRecovery } from './sequencer-recovery'
import { rotateKeys, rotateKeysMany } from './rotate-keys'

export const scripts = {
  'rebuild-repo': rebuildRepo,
  'sequencer-recovery': sequencerRecovery,
  'rotate-keys': rotateKeys,
  'rotate-keys-many': rotateKeysMany,
}
