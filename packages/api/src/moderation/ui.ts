import { ModerationCause } from './types'

export class ModerationUI {
  noOverride = false
  filters: ModerationCause[] = []
  blurs: ModerationCause[] = []
  alerts: ModerationCause[] = []
  informs: ModerationCause[] = []
  get filter(): boolean {
    return this.filters.length !== 0
  }
  get blur(): boolean {
    return this.blurs.length !== 0
  }
  get alert(): boolean {
    return this.alerts.length !== 0
  }
  get inform(): boolean {
    return this.informs.length !== 0
  }
}
