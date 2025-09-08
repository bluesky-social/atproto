import { LexiconDoc } from '@atproto/lexicon'
import { TestPds } from './pds'
import { ServiceProfile } from './service-profile'

const LEXICONS: readonly LexiconDoc[] = [
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
    userDetails = {
      email: 'lex-authority@test.com',
      handle: 'lex-authority.test',
      password: 'hunter2',
    },
  ) {
    const client = pds.getClient()
    await client.createAccount(userDetails)

    return new LexiconAuthorityProfile(pds, client, userDetails)
  }

  async createRecords() {
    await this.client.app.bsky.actor.profile.create(
      { repo: this.did },
      {
        displayName: 'Lexicon Authority',
        description: `the repo containing all the lexicons that can be resolved in dev`,
      },
    )

    for (const doc of LEXICONS) {
      await this.client.com.atproto.repo.createRecord({
        repo: this.did,
        collection: 'com.atproto.lexicon.schema',
        rkey: doc.id,
        record: doc,
      })
    }
  }
}
