import EventEmitter from 'node:events'
import { vi } from 'vitest'
import type { LabelsEvt, Sequencer } from './sequencer.js'

export function createSequencer() {
  const sequencer = new EventEmitter() as Sequencer
  sequencer.lastSeen = 0
  sequencer.destroyed = false
  sequencer.requestLabelRange = vi
    .fn<Sequencer['requestLabelRange']>()
    .mockResolvedValue([])
  return sequencer
}

export function event(seq: number): LabelsEvt {
  return { seq, labels: [] }
}
