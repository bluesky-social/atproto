import { ClientId } from '../client/client-id.js'
import {
  CLIENT_ASSERTION_MAX_AGE,
  CODE_CHALLENGE_REPLAY_TIMEFRAME,
  DPOP_NONCE_MAX_AGE,
  JAR_MAX_AGE,
} from '../constants.js'
import { ReplayStore } from './replay-store.js'

const SECURITY_RATIO = 1.1 // 10% extra time for security
const asTimeFrame = (timeFrame: number) => Math.ceil(timeFrame * SECURITY_RATIO)

export class ReplayManager {
  constructor(protected readonly replayStore: ReplayStore) {}

  async uniqueAuth(
    jti: string,
    clientId: ClientId,
    exp?: number,
  ): Promise<boolean> {
    const timeFrame =
      exp == null
        ? asTimeFrame(CLIENT_ASSERTION_MAX_AGE)
        : exp * 1000 - Date.now()
    return this.replayStore.unique(`Auth@${clientId}`, jti, timeFrame)
  }

  async uniqueJar(jti: string, clientId: ClientId): Promise<boolean> {
    return this.replayStore.unique(
      `JAR@${clientId}`,
      jti,
      asTimeFrame(JAR_MAX_AGE),
    )
  }

  async uniqueDpop(jti: string, clientId?: ClientId): Promise<boolean> {
    return this.replayStore.unique(
      clientId ? `DPoP@${clientId}` : `DPoP`,
      jti,
      asTimeFrame(DPOP_NONCE_MAX_AGE),
    )
  }

  async uniqueCodeChallenge(challenge: string): Promise<boolean> {
    return this.replayStore.unique(
      'CodeChallenge',
      challenge,
      asTimeFrame(CODE_CHALLENGE_REPLAY_TIMEFRAME),
    )
  }
}
