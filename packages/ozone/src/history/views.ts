import { EventView } from '../lexicon/types/tools/ozone/history/defs'
import { ModerationEventRow } from '../mod-service/types'

export const actionEventTypes = [
  'tools.ozone.moderation.defs#modEventTakedown',
  'tools.ozone.moderation.defs#modEventLabel',
  'tools.ozone.moderation.defs#modEventReverseTakedown',
] as const

export const publishableEventTypes = [
  ...actionEventTypes,
  'tools.ozone.moderation.defs#modEventEmail',
] as const

export function modEventToEventView(
  event: ModerationEventRow,
  automods: string[] = [],
): EventView | null {
  const base = {
    subject: event.subjectUri || event.subjectDid,
    createdAt: event.createdAt,
    isAutomated: automods.includes(event.createdBy),
  }

  switch (event.action) {
    case 'tools.ozone.moderation.defs#modEventTakedown':
      return {
        ...base,
        event: {
          $type: 'tools.ozone.history.defs#eventTakedown',
          durationInHours: event.durationInHours || undefined,
        },
      }
    case 'tools.ozone.moderation.defs#modEventReverseTakedown':
      return {
        ...base,
        event: {
          $type: 'tools.ozone.history.defs#eventReverseTakedown',
        },
      }
    case 'tools.ozone.moderation.defs#modEventLabel':
      return {
        ...base,
        event: {
          $type: 'tools.ozone.history.defs#eventLabel',
          createLabelVals: event.createLabelVals
            ? event.createLabelVals.split(',')
            : [],
          negateLabelVals: event.negateLabelVals
            ? event.negateLabelVals.split(',')
            : [],
        },
      }
    case 'tools.ozone.moderation.defs#modEventEmail':
      return {
        ...base,
        event: {
          $type: 'tools.ozone.history.defs#eventEmail',
          subjectLine: event.meta?.['subjectLine']
            ? `${event.meta['subjectLine']}`
            : '',
        },
      }
    default:
      return null
  }
}
