import { describe, expect, it } from 'vitest'
import { PermissionSet, permissionSet } from './permission-set.js'
import { Permission, permission } from './permission.js'

describe('PermissionSet', () => {
  describe('constructor', () => {
    it('creates a PermissionSet instance with all parameters', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [
        permission('app.bsky.feed.post:read', {}),
        permission('app.bsky.feed.post:write', {}),
      ] as const
      const options = {
        title: 'Post Management',
        detail: 'Allows reading and writing posts',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms).toBeInstanceOf(PermissionSet)
      expect(perms.nsid).toBe(nsid)
      expect(perms.permissions).toBe(permissions)
      expect(perms.options).toBe(options)
    })

    it('creates a PermissionSet instance with minimal options', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {}

      const perms = permissionSet(nsid, permissions, options)

      expect(perms).toBeInstanceOf(PermissionSet)
      expect(perms.nsid).toBe(nsid)
      expect(perms.permissions).toBe(permissions)
      expect(perms.options).toEqual({})
    })

    it('creates a PermissionSet instance with empty permissions array', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [] as const
      const options = {}

      const perms = permissionSet(nsid, permissions, options)

      expect(perms).toBeInstanceOf(PermissionSet)
      expect(perms.permissions).toEqual([])
    })

    it('creates a PermissionSet instance with title only', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.like:read', {})] as const
      const options = {
        title: 'Like Management',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBe('Like Management')
      expect(perms.options.detail).toBeUndefined()
    })

    it('creates a PermissionSet instance with detail only', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.like:read', {})] as const
      const options = {
        detail: 'Allows reading likes on posts',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBeUndefined()
      expect(perms.options.detail).toBe('Allows reading likes on posts')
    })

    it('creates a PermissionSet instance with localized titles', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        title: 'Post Management',
        'title:lang': {
          es: 'Gestión de Publicaciones',
          fr: 'Gestion des Publications',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBe('Post Management')
      expect(perms.options['title:lang']).toEqual({
        es: 'Gestión de Publicaciones',
        fr: 'Gestion des Publications',
      })
    })

    it('creates a PermissionSet instance with localized details', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        detail: 'Allows reading posts',
        'detail:lang': {
          es: 'Permite leer publicaciones',
          fr: 'Permet de lire les publications',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.detail).toBe('Allows reading posts')
      expect(perms.options['detail:lang']).toEqual({
        es: 'Permite leer publicaciones',
        fr: 'Permet de lire les publications',
      })
    })

    it('creates a PermissionSet instance with all options including localization', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [
        permission('app.bsky.feed.post:read', {}),
        permission('app.bsky.feed.post:write', {}),
      ] as const
      const options = {
        title: 'Post Management',
        'title:lang': {
          es: 'Gestión de Publicaciones',
          fr: 'Gestion des Publications',
          de: 'Beitragsverwaltung',
        },
        detail: 'Allows reading and writing posts',
        'detail:lang': {
          es: 'Permite leer y escribir publicaciones',
          fr: 'Permet de lire et écrire les publications',
          de: 'Ermöglicht das Lesen und Schreiben von Beiträgen',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBe('Post Management')
      expect(perms.options['title:lang']).toEqual({
        es: 'Gestión de Publicaciones',
        fr: 'Gestion des Publications',
        de: 'Beitragsverwaltung',
      })
      expect(perms.options.detail).toBe('Allows reading and writing posts')
      expect(perms.options['detail:lang']).toEqual({
        es: 'Permite leer y escribir publicaciones',
        fr: 'Permet de lire et écrire les publications',
        de: 'Ermöglicht das Lesen und Schreiben von Beiträgen',
      })
    })
  })

  describe('property immutability', () => {
    it('options object itself is mutable', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = { title: 'Test' }

      const perms = permissionSet(nsid, permissions, options)

      // The reference is readonly, but the object itself can be mutated
      options.title = 'Updated Title'
      expect(perms.options.title).toBe('Updated Title')
    })
  })

  describe('with multiple permissions', () => {
    it('creates a PermissionSet with multiple read permissions', () => {
      const nsid = 'app.bsky.oauth.read'
      const permissions = [
        permission('app.bsky.feed.post:read', {}),
        permission('app.bsky.feed.like:read', {}),
        permission('app.bsky.feed.repost:read', {}),
        permission('app.bsky.graph.follow:read', {}),
      ] as const
      const options = {
        title: 'Read Access',
        detail: 'Allows reading various resources',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.permissions).toHaveLength(4)
      expect(perms.permissions[0].resource).toBe('app.bsky.feed.post:read')
      expect(perms.permissions[1].resource).toBe('app.bsky.feed.like:read')
      expect(perms.permissions[2].resource).toBe('app.bsky.feed.repost:read')
      expect(perms.permissions[3].resource).toBe('app.bsky.graph.follow:read')
    })

    it('creates a PermissionSet with mixed read/write permissions', () => {
      const nsid = 'app.bsky.oauth.full'
      const permissions = [
        permission('app.bsky.feed.post:read', {}),
        permission('app.bsky.feed.post:write', {}),
        permission('app.bsky.feed.like:read', {}),
        permission('app.bsky.feed.like:write', {}),
      ] as const
      const options = {
        title: 'Full Access',
        detail: 'Allows reading and writing posts and likes',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.permissions).toHaveLength(4)
    })

    it('creates a PermissionSet with a single permission', () => {
      const nsid = 'app.bsky.oauth.limited'
      const permissions = [
        permission('app.bsky.actor.profile:read', {}),
      ] as const
      const options = {
        title: 'Profile Read',
        detail: 'Allows reading user profiles only',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.permissions).toHaveLength(1)
      expect(perms.permissions[0].resource).toBe('app.bsky.actor.profile:read')
    })
  })

  describe('edge cases', () => {
    it('handles very long NSID', () => {
      const nsid =
        'com.example.very.long.namespace.identifier.oauth.permissions'
      const permissions = [permission('resource:action', {})] as const
      const options = {}

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.nsid).toBe(nsid)
    })

    it('handles long title strings', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const longTitle = 'A'.repeat(500)
      const options = {
        title: longTitle,
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBe(longTitle)
      expect(perms.options.title?.length).toBe(500)
    })

    it('handles long detail strings', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const longDetail = 'B'.repeat(1000)
      const options = {
        detail: longDetail,
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.detail).toBe(longDetail)
      expect(perms.options.detail?.length).toBe(1000)
    })

    it('handles multiple language codes in title:lang', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        title: 'Post Management',
        'title:lang': {
          es: 'Gestión de Publicaciones',
          fr: 'Gestion des Publications',
          de: 'Beitragsverwaltung',
          it: 'Gestione dei Post',
          pt: 'Gerenciamento de Postagens',
          ja: '投稿管理',
          ko: '게시물 관리',
          'zh-CN': '帖子管理',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(Object.keys(perms.options['title:lang'] || {})).toHaveLength(8)
    })

    it('handles undefined values in title:lang', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        title: 'Post Management',
        'title:lang': {
          es: 'Gestión de Publicaciones',
          fr: undefined,
          de: 'Beitragsverwaltung',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options['title:lang']?.es).toBe('Gestión de Publicaciones')
      expect(perms.options['title:lang']?.fr).toBeUndefined()
      expect(perms.options['title:lang']?.de).toBe('Beitragsverwaltung')
    })

    it('handles undefined values in detail:lang', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        detail: 'Allows reading posts',
        'detail:lang': {
          es: undefined,
          fr: 'Permet de lire les publications',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options['detail:lang']?.es).toBeUndefined()
      expect(perms.options['detail:lang']?.fr).toBe(
        'Permet de lire les publications',
      )
    })

    it('handles special characters in title', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        title: 'Post Management: Read & Write (Full Access)',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBe(
        'Post Management: Read & Write (Full Access)',
      )
    })

    it('handles special characters in detail', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        detail:
          'Allows reading posts, likes & reposts (includes all sub-resources)',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.detail).toBe(
        'Allows reading posts, likes & reposts (includes all sub-resources)',
      )
    })

    it('handles unicode characters in title', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        title: '投稿管理 📝',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBe('投稿管理 📝')
    })

    it('handles empty strings in title', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        title: '',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBe('')
    })

    it('handles empty strings in detail', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        detail: '',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.detail).toBe('')
    })

    it('handles large number of permissions', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = Array.from({ length: 100 }, (_, i) =>
        permission(`resource${i}:action`, {}),
      ) as any
      const options = {}

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.permissions).toHaveLength(100)
    })
  })

  describe('real-world permission set examples', () => {
    it('creates a feed management permission set', () => {
      const nsid = 'app.bsky.oauth.feed'
      const permissions = [
        permission('app.bsky.feed.post:read', {}),
        permission('app.bsky.feed.post:write', {}),
        permission('app.bsky.feed.like:read', {}),
        permission('app.bsky.feed.like:write', {}),
        permission('app.bsky.feed.repost:read', {}),
        permission('app.bsky.feed.repost:write', {}),
      ] as const
      const options = {
        title: 'Feed Management',
        'title:lang': {
          es: 'Gestión de Feed',
          fr: 'Gestion du Feed',
        },
        detail: 'Full access to manage posts, likes, and reposts in your feed',
        'detail:lang': {
          es: 'Acceso completo para gestionar publicaciones, me gusta y reposts en tu feed',
          fr: 'Accès complet pour gérer les publications, les likes et les reposts dans votre fil',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.nsid).toBe('app.bsky.oauth.feed')
      expect(perms.permissions).toHaveLength(6)
      expect(perms.options.title).toBe('Feed Management')
    })

    it('creates a read-only permission set', () => {
      const nsid = 'app.bsky.oauth.readonly'
      const permissions = [
        permission('app.bsky.feed.post:read', {}),
        permission('app.bsky.feed.like:read', {}),
        permission('app.bsky.actor.profile:read', {}),
        permission('app.bsky.graph.follow:read', {}),
      ] as const
      const options = {
        title: 'Read-Only Access',
        detail: 'View posts, likes, profiles, and follows without modification',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.nsid).toBe('app.bsky.oauth.readonly')
      expect(perms.permissions.every((p) => p.resource.endsWith(':read'))).toBe(
        true,
      )
    })

    it('creates a profile management permission set', () => {
      const nsid = 'app.bsky.oauth.profile'
      const permissions = [
        permission('app.bsky.actor.profile:read', {}),
        permission('app.bsky.actor.profile:write', {}),
      ] as const
      const options = {
        title: 'Profile Management',
        'title:lang': {
          es: 'Gestión de Perfil',
          fr: 'Gestion du Profil',
          de: 'Profilverwaltung',
        },
        detail: 'Read and update your profile information',
        'detail:lang': {
          es: 'Leer y actualizar la información de tu perfil',
          fr: 'Lire et mettre à jour les informations de votre profil',
          de: 'Profilinformationen lesen und aktualisieren',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.nsid).toBe('app.bsky.oauth.profile')
      expect(perms.permissions).toHaveLength(2)
    })

    it('creates a minimal permission set', () => {
      const nsid = 'app.bsky.oauth.minimal'
      const permissions = [
        permission('app.bsky.actor.profile:read', {}),
      ] as const
      const options = {
        title: 'Basic Access',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.nsid).toBe('app.bsky.oauth.minimal')
      expect(perms.permissions).toHaveLength(1)
      expect(perms.options.detail).toBeUndefined()
    })
  })

  describe('permission validation', () => {
    it('validates that permissions are Permission instances', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permission1 = permission('app.bsky.feed.post:read', {})
      const permission2 = permission('app.bsky.feed.post:write', {})
      const permissions = [permission1, permission2] as const
      const options = {}

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.permissions[0]).toBeInstanceOf(Permission)
      expect(perms.permissions[1]).toBeInstanceOf(Permission)
    })

    it('preserves permission resource strings', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [
        permission('app.bsky.feed.post:read', {}),
        permission('app.bsky.feed.like:write', {}),
        permission('app.bsky.graph.follow:read', {}),
      ] as const
      const options = {}

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.permissions[0].resource).toBe('app.bsky.feed.post:read')
      expect(perms.permissions[1].resource).toBe('app.bsky.feed.like:write')
      expect(perms.permissions[2].resource).toBe('app.bsky.graph.follow:read')
    })

    it('preserves permission options', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissionOptions = { custom: 'value' }
      const permissions = [
        permission('app.bsky.feed.post:read', permissionOptions),
      ] as const
      const options = {}

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.permissions[0].options).toBe(permissionOptions)
    })
  })

  describe('option variations', () => {
    it('accepts title without detail', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        title: 'Post Reading',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBe('Post Reading')
      expect(perms.options.detail).toBeUndefined()
      expect(perms.options['title:lang']).toBeUndefined()
      expect(perms.options['detail:lang']).toBeUndefined()
    })

    it('accepts detail without title', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        detail: 'Allows reading posts from the feed',
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBeUndefined()
      expect(perms.options.detail).toBe('Allows reading posts from the feed')
      expect(perms.options['title:lang']).toBeUndefined()
      expect(perms.options['detail:lang']).toBeUndefined()
    })

    it('accepts title:lang without title', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        'title:lang': {
          es: 'Gestión de Publicaciones',
          fr: 'Gestion des Publications',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.title).toBeUndefined()
      expect(perms.options['title:lang']).toEqual({
        es: 'Gestión de Publicaciones',
        fr: 'Gestion des Publications',
      })
    })

    it('accepts detail:lang without detail', () => {
      const nsid = 'app.bsky.oauth.permissions'
      const permissions = [permission('app.bsky.feed.post:read', {})] as const
      const options = {
        'detail:lang': {
          es: 'Permite leer publicaciones',
          fr: 'Permet de lire les publications',
        },
      }

      const perms = permissionSet(nsid, permissions, options)

      expect(perms.options.detail).toBeUndefined()
      expect(perms.options['detail:lang']).toEqual({
        es: 'Permite leer publicaciones',
        fr: 'Permet de lire les publications',
      })
    })
  })
})
