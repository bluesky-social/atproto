import { describe, expect, it } from 'vitest'
import { asNsidString } from '../core.js'
import { PermissionSet } from './permission-set.js'
import { Permission } from './permission.js'

describe('PermissionSet', () => {
  describe('constructor', () => {
    it('creates a PermissionSet instance with all parameters', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
        new Permission('app.bsky.feed.post:write', {}),
      ] as const
      const options = {
        title: 'Post Management',
        detail: 'Allows reading and writing posts',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet).toBeInstanceOf(PermissionSet)
      expect(permissionSet.nsid).toBe(nsid)
      expect(permissionSet.permissions).toBe(permissions)
      expect(permissionSet.options).toBe(options)
    })

    it('creates a PermissionSet instance with minimal options', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {}

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet).toBeInstanceOf(PermissionSet)
      expect(permissionSet.nsid).toBe(nsid)
      expect(permissionSet.permissions).toBe(permissions)
      expect(permissionSet.options).toEqual({})
    })

    it('creates a PermissionSet instance with empty permissions array', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [] as const
      const options = {}

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet).toBeInstanceOf(PermissionSet)
      expect(permissionSet.permissions).toEqual([])
    })

    it('creates a PermissionSet instance with title only', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.like:read', {}),
      ] as const
      const options = {
        title: 'Like Management',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBe('Like Management')
      expect(permissionSet.options.detail).toBeUndefined()
    })

    it('creates a PermissionSet instance with detail only', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.like:read', {}),
      ] as const
      const options = {
        detail: 'Allows reading likes on posts',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBeUndefined()
      expect(permissionSet.options.detail).toBe('Allows reading likes on posts')
    })

    it('creates a PermissionSet instance with localized titles', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        title: 'Post Management',
        'title:lang': {
          es: 'Gestión de Publicaciones',
          fr: 'Gestion des Publications',
        },
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBe('Post Management')
      expect(permissionSet.options['title:lang']).toEqual({
        es: 'Gestión de Publicaciones',
        fr: 'Gestion des Publications',
      })
    })

    it('creates a PermissionSet instance with localized details', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        detail: 'Allows reading posts',
        'detail:lang': {
          es: 'Permite leer publicaciones',
          fr: 'Permet de lire les publications',
        },
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.detail).toBe('Allows reading posts')
      expect(permissionSet.options['detail:lang']).toEqual({
        es: 'Permite leer publicaciones',
        fr: 'Permet de lire les publications',
      })
    })

    it('creates a PermissionSet instance with all options including localization', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
        new Permission('app.bsky.feed.post:write', {}),
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

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBe('Post Management')
      expect(permissionSet.options['title:lang']).toEqual({
        es: 'Gestión de Publicaciones',
        fr: 'Gestion des Publications',
        de: 'Beitragsverwaltung',
      })
      expect(permissionSet.options.detail).toBe(
        'Allows reading and writing posts',
      )
      expect(permissionSet.options['detail:lang']).toEqual({
        es: 'Permite leer y escribir publicaciones',
        fr: 'Permet de lire et écrire les publications',
        de: 'Ermöglicht das Lesen und Schreiben von Beiträgen',
      })
    })
  })

  describe('property immutability', () => {
    it('options object itself is mutable', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = { title: 'Test' }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      // The reference is readonly, but the object itself can be mutated
      options.title = 'Updated Title'
      expect(permissionSet.options.title).toBe('Updated Title')
    })
  })

  describe('with multiple permissions', () => {
    it('creates a PermissionSet with multiple read permissions', () => {
      const nsid = asNsidString('app.bsky.oauth.read')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
        new Permission('app.bsky.feed.like:read', {}),
        new Permission('app.bsky.feed.repost:read', {}),
        new Permission('app.bsky.graph.follow:read', {}),
      ] as const
      const options = {
        title: 'Read Access',
        detail: 'Allows reading various resources',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.permissions).toHaveLength(4)
      expect(permissionSet.permissions[0].resource).toBe(
        'app.bsky.feed.post:read',
      )
      expect(permissionSet.permissions[1].resource).toBe(
        'app.bsky.feed.like:read',
      )
      expect(permissionSet.permissions[2].resource).toBe(
        'app.bsky.feed.repost:read',
      )
      expect(permissionSet.permissions[3].resource).toBe(
        'app.bsky.graph.follow:read',
      )
    })

    it('creates a PermissionSet with mixed read/write permissions', () => {
      const nsid = asNsidString('app.bsky.oauth.full')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
        new Permission('app.bsky.feed.post:write', {}),
        new Permission('app.bsky.feed.like:read', {}),
        new Permission('app.bsky.feed.like:write', {}),
      ] as const
      const options = {
        title: 'Full Access',
        detail: 'Allows reading and writing posts and likes',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.permissions).toHaveLength(4)
    })

    it('creates a PermissionSet with a single permission', () => {
      const nsid = asNsidString('app.bsky.oauth.limited')
      const permissions = [
        new Permission('app.bsky.actor.profile:read', {}),
      ] as const
      const options = {
        title: 'Profile Read',
        detail: 'Allows reading user profiles only',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.permissions).toHaveLength(1)
      expect(permissionSet.permissions[0].resource).toBe(
        'app.bsky.actor.profile:read',
      )
    })
  })

  describe('edge cases', () => {
    it('handles very long NSID', () => {
      const nsid = asNsidString(
        'com.example.very.long.namespace.identifier.oauth.permissions',
      )
      const permissions = [new Permission('resource:action', {})] as const
      const options = {}

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.nsid).toBe(nsid)
    })

    it('handles long title strings', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const longTitle = 'A'.repeat(500)
      const options = {
        title: longTitle,
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBe(longTitle)
      expect(permissionSet.options.title?.length).toBe(500)
    })

    it('handles long detail strings', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const longDetail = 'B'.repeat(1000)
      const options = {
        detail: longDetail,
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.detail).toBe(longDetail)
      expect(permissionSet.options.detail?.length).toBe(1000)
    })

    it('handles multiple language codes in title:lang', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
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

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(
        Object.keys(permissionSet.options['title:lang'] || {}),
      ).toHaveLength(8)
    })

    it('handles undefined values in title:lang', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        title: 'Post Management',
        'title:lang': {
          es: 'Gestión de Publicaciones',
          fr: undefined,
          de: 'Beitragsverwaltung',
        },
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options['title:lang']?.es).toBe(
        'Gestión de Publicaciones',
      )
      expect(permissionSet.options['title:lang']?.fr).toBeUndefined()
      expect(permissionSet.options['title:lang']?.de).toBe('Beitragsverwaltung')
    })

    it('handles undefined values in detail:lang', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        detail: 'Allows reading posts',
        'detail:lang': {
          es: undefined,
          fr: 'Permet de lire les publications',
        },
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options['detail:lang']?.es).toBeUndefined()
      expect(permissionSet.options['detail:lang']?.fr).toBe(
        'Permet de lire les publications',
      )
    })

    it('handles special characters in title', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        title: 'Post Management: Read & Write (Full Access)',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBe(
        'Post Management: Read & Write (Full Access)',
      )
    })

    it('handles special characters in detail', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        detail:
          'Allows reading posts, likes & reposts (includes all sub-resources)',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.detail).toBe(
        'Allows reading posts, likes & reposts (includes all sub-resources)',
      )
    })

    it('handles unicode characters in title', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        title: '投稿管理 📝',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBe('投稿管理 📝')
    })

    it('handles empty strings in title', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        title: '',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBe('')
    })

    it('handles empty strings in detail', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        detail: '',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.detail).toBe('')
    })

    it('handles large number of permissions', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = Array.from(
        { length: 100 },
        (_, i) => new Permission(`resource${i}:action`, {}),
      ) as any
      const options = {}

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.permissions).toHaveLength(100)
    })
  })

  describe('real-world permission set examples', () => {
    it('creates a feed management permission set', () => {
      const nsid = asNsidString('app.bsky.oauth.feed')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
        new Permission('app.bsky.feed.post:write', {}),
        new Permission('app.bsky.feed.like:read', {}),
        new Permission('app.bsky.feed.like:write', {}),
        new Permission('app.bsky.feed.repost:read', {}),
        new Permission('app.bsky.feed.repost:write', {}),
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

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.nsid).toBe('app.bsky.oauth.feed')
      expect(permissionSet.permissions).toHaveLength(6)
      expect(permissionSet.options.title).toBe('Feed Management')
    })

    it('creates a read-only permission set', () => {
      const nsid = asNsidString('app.bsky.oauth.readonly')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
        new Permission('app.bsky.feed.like:read', {}),
        new Permission('app.bsky.actor.profile:read', {}),
        new Permission('app.bsky.graph.follow:read', {}),
      ] as const
      const options = {
        title: 'Read-Only Access',
        detail: 'View posts, likes, profiles, and follows without modification',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.nsid).toBe('app.bsky.oauth.readonly')
      expect(
        permissionSet.permissions.every((p) => p.resource.endsWith(':read')),
      ).toBe(true)
    })

    it('creates a profile management permission set', () => {
      const nsid = asNsidString('app.bsky.oauth.profile')
      const permissions = [
        new Permission('app.bsky.actor.profile:read', {}),
        new Permission('app.bsky.actor.profile:write', {}),
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

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.nsid).toBe('app.bsky.oauth.profile')
      expect(permissionSet.permissions).toHaveLength(2)
    })

    it('creates a minimal permission set', () => {
      const nsid = asNsidString('app.bsky.oauth.minimal')
      const permissions = [
        new Permission('app.bsky.actor.profile:read', {}),
      ] as const
      const options = {
        title: 'Basic Access',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.nsid).toBe('app.bsky.oauth.minimal')
      expect(permissionSet.permissions).toHaveLength(1)
      expect(permissionSet.options.detail).toBeUndefined()
    })
  })

  describe('permission validation', () => {
    it('validates that permissions are Permission instances', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permission1 = new Permission('app.bsky.feed.post:read', {})
      const permission2 = new Permission('app.bsky.feed.post:write', {})
      const permissions = [permission1, permission2] as const
      const options = {}

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.permissions[0]).toBeInstanceOf(Permission)
      expect(permissionSet.permissions[1]).toBeInstanceOf(Permission)
    })

    it('preserves permission resource strings', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
        new Permission('app.bsky.feed.like:write', {}),
        new Permission('app.bsky.graph.follow:read', {}),
      ] as const
      const options = {}

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.permissions[0].resource).toBe(
        'app.bsky.feed.post:read',
      )
      expect(permissionSet.permissions[1].resource).toBe(
        'app.bsky.feed.like:write',
      )
      expect(permissionSet.permissions[2].resource).toBe(
        'app.bsky.graph.follow:read',
      )
    })

    it('preserves permission options', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissionOptions = { custom: 'value' }
      const permissions = [
        new Permission('app.bsky.feed.post:read', permissionOptions),
      ] as const
      const options = {}

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.permissions[0].options).toBe(permissionOptions)
    })
  })

  describe('option variations', () => {
    it('accepts title without detail', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        title: 'Post Reading',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBe('Post Reading')
      expect(permissionSet.options.detail).toBeUndefined()
      expect(permissionSet.options['title:lang']).toBeUndefined()
      expect(permissionSet.options['detail:lang']).toBeUndefined()
    })

    it('accepts detail without title', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        detail: 'Allows reading posts from the feed',
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBeUndefined()
      expect(permissionSet.options.detail).toBe(
        'Allows reading posts from the feed',
      )
      expect(permissionSet.options['title:lang']).toBeUndefined()
      expect(permissionSet.options['detail:lang']).toBeUndefined()
    })

    it('accepts title:lang without title', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        'title:lang': {
          es: 'Gestión de Publicaciones',
          fr: 'Gestion des Publications',
        },
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.title).toBeUndefined()
      expect(permissionSet.options['title:lang']).toEqual({
        es: 'Gestión de Publicaciones',
        fr: 'Gestion des Publications',
      })
    })

    it('accepts detail:lang without detail', () => {
      const nsid = asNsidString('app.bsky.oauth.permissions')
      const permissions = [
        new Permission('app.bsky.feed.post:read', {}),
      ] as const
      const options = {
        'detail:lang': {
          es: 'Permite leer publicaciones',
          fr: 'Permet de lire les publications',
        },
      }

      const permissionSet = new PermissionSet(nsid, permissions, options)

      expect(permissionSet.options.detail).toBeUndefined()
      expect(permissionSet.options['detail:lang']).toEqual({
        es: 'Permite leer publicaciones',
        fr: 'Permet de lire les publications',
      })
    })
  })
})
