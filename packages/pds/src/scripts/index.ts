import { rebuildRepo } from './rebuild-repo'
import { sequencerRecovery } from './sequencer-recovery'
import { rotateKeys } from './rotate-keys'

export const scripts = {
  'rebuild-repo': rebuildRepo,
  'sequencer-recovery': sequencerRecovery,
  'rotate-keys': rotateKeys,
}
