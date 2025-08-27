import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { TestPds } from './pds'
import {
  ServiceMigrationOptions,
  ServiceProfile,
  ServiceUserDetails,
} from './service-profile'

export class OzoneServiceProfile extends ServiceProfile {
  static async create(
    pds: TestPds,
    ozoneUrl: string,
    userDetails = {
      email: 'mod-authority@test.com',
      handle: 'mod-authority.test',
      password: 'hunter2',
    },
  ) {
    const client = pds.getClient()
    await client.createAccount(userDetails)

    const key = await Secp256k1Keypair.create({ exportable: true })

    return new OzoneServiceProfile(pds, client, userDetails, ozoneUrl, key)
  }

  protected constructor(
    pds: TestPds,
    client: AtpAgent,
    userDetails: ServiceUserDetails,
    readonly ozoneUrl: string,
    readonly key: Secp256k1Keypair,
  ) {
    super(pds, client, userDetails)
  }

  async createAppPasswordForVerification() {
    const { data } = await this.client.com.atproto.server.createAppPassword({
      name: 'ozone-verifier',
    })
    return data.password
  }

  async migrateTo(pds: TestPds, options: ServiceMigrationOptions = {}) {
    await super.migrateTo(pds, {
      ...options,
      services: {
        ...options.services,
        atproto_labeler: {
          type: 'AtprotoLabeler',
          endpoint: this.ozoneUrl,
        },
      },
      verificationMethods: {
        ...options.verificationMethods,
        atproto_label: this.key.did(),
      },
    })
  }

  async createRecords() {
    await this.client.app.bsky.actor.profile.create(
      { repo: this.did },
      {
        displayName: 'Dev-env Moderation',
        description: `The pretend version of mod.bsky.app`,
      },
    )

    await this.client.app.bsky.labeler.service.create(
      { repo: this.did, rkey: 'self' },
      {
        policies: {
          labelValues: [
            '!hide',
            '!warn',
            'porn',
            'sexual',
            'nudity',
            'sexual-figurative',
            'graphic-media',
            'self-harm',
            'sensitive',
            'extremist',
            'intolerant',
            'threat',
            'rude',
            'illicit',
            'security',
            'unsafe-link',
            'impersonation',
            'misinformation',
            'scam',
            'engagement-farming',
            'spam',
            'rumor',
            'misleading',
            'inauthentic',
          ],
          labelValueDefinitions: [
            {
              identifier: 'spam',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Spam',
                  description:
                    'Unwanted, repeated, or unrelated actions that bother users.',
                },
              ],
            },
            {
              identifier: 'impersonation',
              blurs: 'none',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Impersonation',
                  description:
                    'Pretending to be someone else without permission.',
                },
              ],
            },
            {
              identifier: 'scam',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Scam',
                  description: 'Scams, phishing & fraud.',
                },
              ],
            },
            {
              identifier: 'intolerant',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Intolerance',
                  description: 'Discrimination against protected groups.',
                },
              ],
            },
            {
              identifier: 'self-harm',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Self-Harm',
                  description:
                    'Promotes self-harm, including graphic images, glorifying discussions, or triggering stories.',
                },
              ],
            },
            {
              identifier: 'security',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Security Concerns',
                  description:
                    'May be unsafe and could harm your device, steal your info, or get your account hacked.',
                },
              ],
            },
            {
              identifier: 'misleading',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Misleading',
                  description:
                    'Altered images/videos, deceptive links, or false statements.',
                },
              ],
            },
            {
              identifier: 'threat',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Threats',
                  description:
                    'Promotes violence or harm towards others, including threats, incitement, or advocacy of harm.',
                },
              ],
            },
            {
              identifier: 'unsafe-link',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Unsafe link',
                  description:
                    'Links to harmful sites with malware, phishing, or violating content that risk security and privacy.',
                },
              ],
            },
            {
              identifier: 'illicit',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Illicit',
                  description:
                    'Promoting or selling potentially illicit goods, services, or activities.',
                },
              ],
            },
            {
              identifier: 'misinformation',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Misinformation',
                  description:
                    'Spreading false or misleading info, including unverified claims and harmful conspiracy theories.',
                },
              ],
            },
            {
              identifier: 'rumor',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Rumor',
                  description:
                    'Approach with caution, as these claims lack evidence from credible sources.',
                },
              ],
            },
            {
              identifier: 'rude',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Rude',
                  description:
                    'Rude or impolite, including crude language and disrespectful comments, without constructive purpose.',
                },
              ],
            },
            {
              identifier: 'extremist',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Extremist',
                  description:
                    'Radical views advocating violence, hate, or discrimination against individuals or groups.',
                },
              ],
            },
            {
              identifier: 'sensitive',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Sensitive',
                  description:
                    'May be upsetting, covering topics like substance abuse or mental health issues, cautioning sensitive viewers.',
                },
              ],
            },
            {
              identifier: 'engagement-farming',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Engagement Farming',
                  description:
                    'Insincere content or bulk actions aimed at gaining followers, including frequent follows, posts, and likes.',
                },
              ],
            },
            {
              identifier: 'inauthentic',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Inauthentic Account',
                  description: 'Bot or a person pretending to be someone else.',
                },
              ],
            },
            {
              identifier: 'sexual-figurative',
              blurs: 'media',
              severity: 'none',
              defaultSetting: 'show',
              adultOnly: true,
              locales: [
                {
                  lang: 'en',
                  name: 'Sexually Suggestive (Cartoon)',
                  description:
                    'Art with explicit or suggestive sexual themes, including provocative imagery or partial nudity.',
                },
              ],
            },
          ],
        },
        createdAt: new Date().toISOString(),
      },
    )
  }
}
