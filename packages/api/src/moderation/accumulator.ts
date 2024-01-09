import { AppBskyGraphDefs } from '../client/index'
import {
  Label,
  LabelPreference,
  ModerationCause,
  ModerationOpts,
  ModerationDecision,
} from './types'
import { LABELS } from './const/labels'

export class ModerationCauseAccumulator {
  did = ''
  causes: ModerationCause[] = []

  constructor() {}

  setDid(did: string) {
    this.did = did
  }

  addBlocking(blocking: string | undefined) {
    if (blocking) {
      this.causes.push({
        type: 'blocking',
        source: { type: 'user' },
        priority: 3,
      })
    }
  }

  addBlockingByList(
    blockingByList: AppBskyGraphDefs.ListViewBasic | undefined,
  ) {
    if (blockingByList) {
      this.causes.push({
        type: 'blocking',
        source: { type: 'list', list: blockingByList },
        priority: 3,
      })
    }
  }

  addBlockedBy(blockedBy: boolean | undefined) {
    if (blockedBy) {
      this.causes.push({
        type: 'blocked-by',
        source: { type: 'user' },
        priority: 4,
      })
    }
  }

  addBlockOther(blockOther: boolean | undefined) {
    if (blockOther) {
      this.causes.push({
        type: 'block-other',
        source: { type: 'user' },
        priority: 4,
      })
    }
  }

  addLabel(label: Label, opts: ModerationOpts) {
    // look up the label definition
    const labelDef = LABELS[label.val]
    if (!labelDef) {
      // ignore labels we don't understand
      return
    }

    // look up the label preference
    const isSelf = label.src === this.did
    const labeler = isSelf
      ? undefined
      : opts.labelers.find((s) => s.labeler.did === label.src)

    /* TODO when 3P labelers are supported
    if (!isSelf && !labeler) {
      return // skip labelers not configured by the user
    }*/

    // establish the label preference for interpretation
    let labelPref: LabelPreference = 'ignore'
    if (!labelDef.configurable) {
      labelPref = labelDef.preferences[0]
    } else if (labelDef.flags.includes('adult') && !opts.adultContentEnabled) {
      labelPref = 'hide'
    } else if (labeler?.labels[label.val]) {
      labelPref = labeler.labels[label.val]
    } else if (opts.labels[label.val]) {
      labelPref = opts.labels[label.val]
    }

    // ignore labels the user has asked to ignore
    if (labelPref === 'ignore') {
      return
    }

    // ignore 'unauthed' labels when the user is authed
    if (labelDef.flags.includes('unauthed') && !!opts.userDid) {
      return
    }

    // establish the priority of the label
    let priority: 1 | 2 | 5 | 7 | 8
    if (labelDef.flags.includes('no-override')) {
      priority = 1
    } else if (labelPref === 'hide') {
      priority = 2
    } else if (labelDef.onwarn === 'blur') {
      priority = 5
    } else if (labelDef.onwarn === 'blur-media') {
      priority = 7
    } else {
      priority = 8
    }

    this.causes.push({
      type: 'label',
      source:
        isSelf || !labeler
          ? { type: 'user' }
          : { type: 'labeler', labeler: labeler.labeler },
      label,
      labelDef,
      setting: labelPref,
      priority,
    })
  }

  addMuted(muted: boolean | undefined) {
    if (muted) {
      this.causes.push({
        type: 'muted',
        source: { type: 'user' },
        priority: 6,
      })
    }
  }

  addMutedByList(mutedByList: AppBskyGraphDefs.ListViewBasic | undefined) {
    if (mutedByList) {
      this.causes.push({
        type: 'muted',
        source: { type: 'list', list: mutedByList },
        priority: 6,
      })
    }
  }

  finalizeDecision(opts: ModerationOpts): ModerationDecision {
    const mod = new ModerationDecision()
    mod.did = this.did
    if (!this.causes.length) {
      return mod
    }

    // sort the causes by priority and then choose the top one
    this.causes.sort((a, b) => a.priority - b.priority)
    mod.cause = this.causes[0]
    mod.additionalCauses = this.causes.slice(1)

    // blocked user
    if (
      mod.cause.type === 'blocking' ||
      mod.cause.type === 'blocked-by' ||
      mod.cause.type === 'block-other'
    ) {
      // filter and blur, dont allow override
      mod.filter = true
      mod.blur = true
      mod.noOverride = true
    }
    // muted user
    else if (mod.cause.type === 'muted') {
      // filter and blur
      mod.filter = true
      mod.blur = true
    }
    // labeled subject
    else if (mod.cause.type === 'label') {
      // 'hide' setting
      if (mod.cause.setting === 'hide') {
        // filter
        mod.filter = true
      }

      // 'hide' and 'warn' setting, apply onwarn
      switch (mod.cause.labelDef.onwarn) {
        case 'alert':
          mod.alert = true
          break
        case 'blur':
          mod.blur = true
          break
        case 'blur-media':
          mod.blurMedia = true
          break
        case null:
          // do nothing
          break
      }

      // apply noOverride as needed
      if (mod.cause.labelDef.flags.includes('no-override')) {
        mod.noOverride = true
      } else if (
        mod.cause.labelDef.flags.includes('adult') &&
        !opts.adultContentEnabled
      ) {
        mod.noOverride = true
      }
    }

    return mod
  }
}
