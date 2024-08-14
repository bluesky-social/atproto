import { OzoneConfig } from '../config/config'
import { ModerationService } from '../mod-service'
import { ModSubject } from '../mod-service/subject'
import { ModerationEventRow } from '../mod-service/types'
import { reportAutomationLogger as log } from '../logger'

export type ReportAutomationFlow = {
  escalate: boolean
  labels: string[]
}

export class ReportAutomationService {
  constructor(
    private cfg: OzoneConfig,
    private moderationService: ModerationService,
    private event: ModerationEventRow,
    private subject: ModSubject,
  ) {}

  getFlows(): ReportAutomationFlow {
    const flows: ReportAutomationFlow = {
      escalate: false,
      labels: [],
    }
    if (this.event.action !== 'tools.ozone.moderation.defs#modEventReport') {
      return flows
    }

    const hasEscalationKeyword = this.cfg.automation.escalateKeywords?.some(
      (keyword) => {
        return this.event.comment?.includes(keyword)
      },
    )

    if (
      hasEscalationKeyword &&
      this.cfg.automation.escalators.includes(this.event.createdBy)
    ) {
      flows.escalate = true
    }

    if (this.cfg.automation.labelers.includes(this.event.createdBy)) {
      const labels = this.event.comment
        ?.split(' ')
        .map((word) => {
          const labelKeyword = this.cfg.automation.labelKeywords?.find(
            (keyword) => word.startsWith(`${keyword}:`),
          )
          if (!labelKeyword) {
            return ''
          }

          return word.replace(`${labelKeyword}:`, '')
        })
        .filter(Boolean)

      if (labels?.length) {
        flows.labels = labels
      }
    }

    return flows
  }

  async escalate() {
    await this.moderationService.logEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventEscalate',
        comment:
          '[automation-flow]: Escalated because of a report with configured keyword by escalator',
      },
      subject: this.subject,
      createdBy: this.cfg.service.did,
    })
  }

  async label(labels: string[]) {
    await this.moderationService.logEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: labels,
        negateLabelVals: [],
        comment:
          '[automation-flow]: Labeled because of a report with configured keyword by labeler',
      },
      subject: this.subject,
      createdBy: this.cfg.service.did,
    })
  }

  async invokeFlows() {
    try {
      const flows = this.getFlows()
      const tasks: Promise<void>[] = []

      if (flows.escalate) {
        tasks.push(this.escalate())
      }

      if (flows.labels.length) {
        tasks.push(this.label(flows.labels))
      }

      // Run all tasks in parallel since they are not dependent on each other
      await Promise.all(tasks)
    } catch (err) {
      // Allow failing the automation with a log message since these are not crucial
      log.error({ event: this.event, err }, 'Error invoking automation flows')
    }
  }
}
