import AtpAgent, {
  SessionDispatcher,
  SessionDispatcherOptions,
} from '@atproto/api'
import { EXAMPLE_LABELER } from './const'

export class TestAgent extends AtpAgent {
  protected dispatcher: SessionDispatcher

  constructor(options: SessionDispatcherOptions) {
    const dispatcher = new SessionDispatcher(options)
    super(dispatcher)
    this.dispatcher = dispatcher
    this.configureLabelersHeader([EXAMPLE_LABELER])
  }

  get session() {
    return this.dispatcher.session
  }

  get hasSession() {
    return this.dispatcher.hasSession
  }

  get service() {
    return this.dispatcher.serviceUrl
  }

  login(...args: Parameters<SessionDispatcher['login']>) {
    return this.dispatcher.login(...args)
  }

  createAccount(...args: Parameters<SessionDispatcher['createAccount']>) {
    return this.dispatcher.createAccount(...args)
  }
}
