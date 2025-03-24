import { useQuery } from '@tanstack/react-query'

type Session = {
  email: string
  identifier: string
  username?: string
  displayName?: string
  avatar?: string
  application: {
    url: string
    name: string
    avatar?: string
  }
}

export function useSessionsQuery({ did }: { did: string }) {
  return useQuery<Session[]>({
    queryKey: ['active-sessions', did],
    async queryFn() {
      return [
        {
          email: 'eric@blueskyweb.xyz',
          identifier: 'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
          username: '@esb.lol',
          displayName: 'Eric',
          avatar:
            'https://cdn.bsky.app/img/avatar/plain/did:plc:3jpt2mvvsumj2r7eqk4gzzjz/bafkreiaexnb3bkzbaxktm5q3l3txyweflh3smcruigesvroqjrqxec4zv4@jpeg',
          application: {
            name: 'Bluesky',
            avatar: '',
            url: 'https://bsky.app',
          },
        },
        {
          email: 'eric@blueskyweb.xyz',
          identifier: 'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
          username: '@eric.flashes.app',
          displayName: 'Eric',
          avatar:
            'https://cdn.bsky.app/img/avatar/plain/did:plc:3jpt2mvvsumj2r7eqk4gzzjz/bafkreiaexnb3bkzbaxktm5q3l3txyweflh3smcruigesvroqjrqxec4zv4@jpeg',
          application: {
            name: 'Flashes',
            avatar: '',
            url: 'https://flashes.app',
          },
        },
      ]
    },
  })
}
