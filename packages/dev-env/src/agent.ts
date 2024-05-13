import AtpAgent, {
  AtpSessionManager,
  AtpSessionManagerOptions,
} from '@atproto/api'
import { EXAMPLE_LABELER } from './const'

export class TestAgent extends AtpAgent {
  readonly sessionManager: AtpSessionManager

  constructor(options: AtpSessionManagerOptions) {
    const sessionManager = new AtpSessionManager(options)
    super(sessionManager)
    this.sessionManager = sessionManager
    this.configureLabelersHeader([EXAMPLE_LABELER])
  }

  get session() {
    return this.sessionManager.session
  }

  get hasSession() {
    return this.sessionManager.hasSession
  }

  get service() {
    return this.sessionManager.serviceUrl
  }

  login(...args: Parameters<AtpSessionManager['login']>) {
    return this.sessionManager.login(...args)
  }

  createAccount(...args: Parameters<AtpSessionManager['createAccount']>) {
    return this.sessionManager.createAccount(...args)
  }
}
