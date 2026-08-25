import type { Selectable } from 'kysely'
import type {
  AtUriString,
  DatetimeString,
  DidString,
  HandleString,
} from '@atproto/lex'
import { Client, currentDatetimeString } from '@atproto/lex'
import { PasswordSession } from '@atproto/lex-password-session'
import { AtUri } from '@atproto/syntax'
import type { VerifierConfig } from '../config/index.js'
import type { Verification } from '../db/schema/verification.js'
import { app, com, tools } from '../lexicons/index.js'

export type VerificationInput = {
  displayName: string
  handle: HandleString
  subject: DidString
  createdAt?: DatetimeString
}

export type VerificationIssuerCreator = (
  verifierConfig: VerifierConfig,
) => VerificationIssuer

const HANDLE_INVALID = 'handle.invalid'

export class VerificationIssuer {
  private clientPromise: Promise<Client> | undefined
  constructor(private verifierConfig: VerifierConfig) {}

  static creator() {
    return (verifierConfig: VerifierConfig) =>
      new VerificationIssuer(verifierConfig)
  }

  private async login() {
    const session = await PasswordSession.login({
      service: this.verifierConfig.url,
      identifier: this.verifierConfig.did,
      password: this.verifierConfig.password,
      // PasswordSession refreshes the access token on its own, but it does not
      // retain the password, so it cannot recover once the refresh token stops
      // working. Drop the cached client when that happens and let the next
      // caller log in again.
      onDeleted: () => {
        this.clientPromise = undefined
      },
    })
    return new Client(session)
  }

  async getClient() {
    // Memoized so that concurrent callers share one login instead of each
    // creating a session, all but one of which would be orphaned.
    this.clientPromise ??= this.login().catch((err) => {
      this.clientPromise = undefined
      throw err
    })
    return this.clientPromise
  }

  async verify(verifications: VerificationInput[]) {
    const grantedVerifications: Selectable<Verification>[] = []
    const failedVerifications: tools.ozone.verification.grantVerifications.GrantError[] =
      []
    const now = currentDatetimeString()
    const client = await this.getClient()
    await Promise.allSettled(
      verifications.map(async ({ displayName, handle, subject, createdAt }) => {
        if (handle.toLowerCase() === HANDLE_INVALID) {
          failedVerifications.push(
            tools.ozone.verification.grantVerifications.grantError.$build({
              error: 'Cannot verify with invalid handle',
              subject,
            }),
          )
          return
        }

        try {
          const verificationRecord = {
            createdAt: createdAt || now,
            issuer: this.verifierConfig.did,
            displayName,
            handle,
            subject,
          }
          const { uri, cid } = await client.call(
            com.atproto.repo.createRecord,
            {
              repo: this.verifierConfig.did,
              record: verificationRecord,
              collection: app.bsky.graph.verification.$nsid,
            },
          )
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
          failedVerifications.push(
            tools.ozone.verification.grantVerifications.grantError.$build({
              error: err instanceof Error ? err.message : String(err),
              subject,
            }),
          )
          return
        }
      }),
    )

    return { grantedVerifications, failedVerifications }
  }

  async revoke({ uris }: { uris: AtUriString[] }) {
    const revokedVerifications: AtUriString[] = []
    const failedRevocations: Array<{ uri: AtUriString; error: string }> = []

    const client = await this.getClient()

    await Promise.allSettled(
      uris.map(async (uri) => {
        try {
          const atUri = new AtUri(uri)

          if (atUri.collection !== app.bsky.graph.verification.$nsid) {
            throw new Error(`Only verification records can be revoked`)
          }

          if (atUri.host !== this.verifierConfig.did) {
            throw new Error(
              `Cannot revoke verification record ${uri} not issued by ${this.verifierConfig.did}`,
            )
          }

          await client.call(com.atproto.repo.deleteRecord, {
            collection: atUri.collection,
            repo: this.verifierConfig.did,
            rkey: atUri.rkey,
          })
          revokedVerifications.push(uri)
        } catch (err) {
          failedRevocations.push({
            uri,
            error: err instanceof Error ? err.message : String(err),
          })
          return
        }
      }),
    )

    return { revokedVerifications, failedRevocations }
  }
}
