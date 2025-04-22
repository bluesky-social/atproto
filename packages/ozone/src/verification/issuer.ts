import { Selectable } from 'kysely'
import AtpAgent, { AtUri } from '@atproto/api'
import { VerifierConfig } from '../config'
import { Verification } from '../db/schema/verification'

export type VerificationInput = {
  displayName: string
  handle: string
  subject: string
  createdAt?: string
}

export type VerificationIssuerCreator = (
  verifierConfig: VerifierConfig,
) => VerificationIssuer

export class VerificationIssuer {
  private agent: AtpAgent | null = null
  constructor(private verifierConfig: VerifierConfig) {}

  static creator() {
    return (verifierConfig: VerifierConfig) =>
      new VerificationIssuer(verifierConfig)
  }

  // @TODO: Probably shouldn't login for every req?
  async getAgent() {
    if (!this.agent) {
      this.agent = new AtpAgent({ service: this.verifierConfig.url })
      await this.agent.login({
        identifier: this.verifierConfig.did,
        password: this.verifierConfig.password,
      })
    }

    return this.agent
  }

  async verify(verifications: VerificationInput[]) {
    const grantedVerifications: Selectable<Verification>[] = []
    const failedVerifications: {
      $type: 'tools.ozone.verification.grantVerifications#grantError'
      subject: string
      error: string
    }[] = []
    const now = new Date().toISOString()
    const agent = await this.getAgent()
    await Promise.allSettled(
      verifications.map(async ({ displayName, handle, subject, createdAt }) => {
        try {
          const verificationRecord = {
            createdAt: createdAt || now,
            issuer: this.verifierConfig.did,
            displayName,
            handle,
            subject,
          }
          const {
            data: { uri, cid },
          } = await agent.com.atproto.repo.createRecord({
            repo: this.verifierConfig.did,
            record: verificationRecord,
            collection: 'app.bsky.graph.verification',
          })
          grantedVerifications.push({
            ...verificationRecord,
            uri,
            cid,
            revokedAt: null,
            updatedAt: now,
            revokedBy: null,
            revokeReason: null,
          })
        } catch (err) {
          failedVerifications.push({
            $type: 'tools.ozone.verification.grantVerifications#grantError',
            error: (err as Error).message,
            subject,
          })
          return
        }
      }),
    )

    return { grantedVerifications, failedVerifications }
  }

  async revoke({ uris }: { uris: string[] }) {
    const revokedVerifications: string[] = []
    const failedRevocations: string[] = []

    const agent = await this.getAgent()

    await Promise.allSettled(
      uris.map(async (uri) => {
        try {
          const atUri = new AtUri(uri)

          if (atUri.collection !== 'app.bsky.graph.verification') {
            throw new Error(`Only verification records can be revoked`)
          }

          if (atUri.host !== this.verifierConfig.did) {
            throw new Error(
              `Cannot revoke verification record ${uri} not issued by ${this.verifierConfig.did}`,
            )
          }

          await agent.com.atproto.repo.deleteRecord({
            collection: atUri.collection,
            repo: this.verifierConfig.did,
            rkey: atUri.rkey,
          })
          revokedVerifications.push(uri)
        } catch (err) {
          failedRevocations.push(uri)
          return
        }
      }),
    )

    return { revokedVerifications, failedRevocations }
  }
}
