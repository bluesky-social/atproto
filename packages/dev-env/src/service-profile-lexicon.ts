import type { LexiconDocument } from '@atproto/lex-document'
import { PasswordSession } from '@atproto/lex-password-session'
import { app, com } from './lexicons/index.js'
import type { TestPds } from './pds.js'
import { ServiceProfile, type ServiceUserDetails } from './service-profile.js'

const LEXICONS: readonly LexiconDocument[] = [
  {
    lexicon: 1,
    id: 'com.atproto.moderation.basePermissions',
    defs: {
      main: {
        type: 'permission-set',
        title: 'Moderation',
        'title:lang': { fr: 'Modération' },
        detail: 'Create moderation reports',
        'detail:lang': {
          'fr-FR': 'Créer des rapports de modération',
        },
        permissions: [
          {
            type: 'permission',
            resource: 'rpc',
            aud: '*',
            lxm: ['com.atproto.moderation.createReport'],
          },
        ],
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.calendar.basePermissions',
    defs: {
      main: {
        type: 'permission-set',
        title: 'Calendar',
        'title:lang': { fr: 'Calendrier' },
        detail: 'Manage your events and RSVPs',
        'detail:lang': {
          'fr-BE': 'Gérer vos événements et réponses',
        },
        permissions: [
          {
            type: 'permission',
            resource: 'rpc',
            inheritAud: true,
            lxm: [
              'com.example.calendar.listEvents',
              'com.example.calendar.getEventDetails',
              'com.example.calendar.getEventRsvps',
            ],
          },
          {
            type: 'permission',
            resource: 'repo',
            collection: [
              'com.example.calendar.event',
              'com.example.calendar.rsvp',
            ],
          },
          {
            type: 'permission',
            resource: 'blob',
            accept: ['image/*', 'video/*'],
          },
        ],
      },
    },
  },
]

export class LexiconAuthorityProfile extends ServiceProfile {
  public static async create(
    pds: TestPds,
    userDetails: ServiceUserDetails = {
      email: 'lex-authority@test.com',
      handle: 'lex-authority.test',
      password: 'hunter2',
    },
  ) {
    const session = await PasswordSession.createAccount(userDetails, {
      service: pds.url,
    })

    return new LexiconAuthorityProfile(pds, session, userDetails)
  }

  async createRecords() {
    await this.client.create(app.bsky.actor.profile, {
      displayName: 'Lexicon Authority',
      description: `the repo containing all the lexicons that can be resolved in dev`,
    })

    for (const doc of LEXICONS) {
      await this.client.call(com.atproto.repo.createRecord, {
        repo: this.did,
        collection: 'com.atproto.lexicon.schema',
        rkey: doc.id,
        record: doc,
      })
    }
  }
}
