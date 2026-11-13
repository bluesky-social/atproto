import { describe, expect, it } from 'vitest'
import { compareVersions, isUnicastIpHostname, parseVersion } from './util.js'

describe(isUnicastIpHostname, () => {
  describe('IPv4', () => {
    it('should return true for unicast IP addresses', () => {
      expect(isUnicastIpHostname('1.1.1.1')).toBe(true)
      expect(isUnicastIpHostname('8.8.8.8')).toBe(true)
    })

    it('should return false for Multicast IP addresses', () => {
      // https://en.wikipedia.org/wiki/Multicast_address

      expect(isUnicastIpHostname('224.0.0.0')).toBe(false)
      expect(isUnicastIpHostname('224.0.0.255')).toBe(false)
      expect(isUnicastIpHostname('224.0.1.0')).toBe(false)
      expect(isUnicastIpHostname('224.0.1.255')).toBe(false)
      expect(isUnicastIpHostname('224.0.2.0')).toBe(false)
      expect(isUnicastIpHostname('224.0.255.255')).toBe(false)
      expect(isUnicastIpHostname('224.1.0.0')).toBe(false)
      expect(isUnicastIpHostname('224.1.255.255')).toBe(false)
      expect(isUnicastIpHostname('224.2.0.0')).toBe(false)
      expect(isUnicastIpHostname('224.2.255.255')).toBe(false)
      expect(isUnicastIpHostname('224.3.0.0')).toBe(false)
      expect(isUnicastIpHostname('224.4.255.255')).toBe(false)
      expect(isUnicastIpHostname('224.5.0.0')).toBe(false)
      expect(isUnicastIpHostname('224.255.255.255')).toBe(false)
      expect(isUnicastIpHostname('225.0.0.0')).toBe(false)
      expect(isUnicastIpHostname('231.255.255.255')).toBe(false)
      expect(isUnicastIpHostname('232.0.0.0')).toBe(false)
      expect(isUnicastIpHostname('232.255.255.255')).toBe(false)
      expect(isUnicastIpHostname('233.0.0.0')).toBe(false)
      expect(isUnicastIpHostname('233.251.255.255')).toBe(false)
      expect(isUnicastIpHostname('233.252.0.0')).toBe(false)
      expect(isUnicastIpHostname('233.255.255.255')).toBe(false)
      expect(isUnicastIpHostname('234.0.0.0')).toBe(false)
      expect(isUnicastIpHostname('234.255.255.255')).toBe(false)
      expect(isUnicastIpHostname('235.0.0.0')).toBe(false)
      expect(isUnicastIpHostname('238.255.255.255')).toBe(false)
      expect(isUnicastIpHostname('239.0.0.0')).toBe(false)
      expect(isUnicastIpHostname('239.255.255.255')).toBe(false)
    })

    it('should return false for loopback IP addresses', () => {
      // https://en.wikipedia.org/wiki/Loopback

      expect(isUnicastIpHostname('127.0.0.0')).toBe(false)
      expect(isUnicastIpHostname('127.0.0.1')).toBe(false)
      expect(isUnicastIpHostname('127.0.34.54')).toBe(false)
      expect(isUnicastIpHostname('127.255.255.255')).toBe(false)
    })

    it('should return false for private IP addresses', () => {
      // https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces

      expect(isUnicastIpHostname('10.0.0.0')).toBe(false)
      expect(isUnicastIpHostname('10.255.255.255')).toBe(false)
      expect(isUnicastIpHostname('172.16.0.0')).toBe(false)
      expect(isUnicastIpHostname('172.16.0.1')).toBe(false)
      expect(isUnicastIpHostname('172.31.255.255')).toBe(false)
      expect(isUnicastIpHostname('192.168.0.0')).toBe(false)
      expect(isUnicastIpHostname('192.168.1.1')).toBe(false)
      expect(isUnicastIpHostname('192.168.255.255')).toBe(false)
    })
  })

  it('should return undefined for non-IP hostnames', () => {
    expect(isUnicastIpHostname('example.com')).toBeUndefined()
    expect(isUnicastIpHostname('localhost')).toBeUndefined()
  })
})

describe(parseVersion, () => {
  it('should parse valid version strings', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3])
    expect(parseVersion('0.0.1')).toEqual([0, 0, 1])
    expect(parseVersion('10.20.30')).toEqual([10, 20, 30])
  })

  it('should return undefined for invalid version strings', () => {
    expect(parseVersion('1.2')).toBeUndefined()
    expect(parseVersion('1.2.3.4')).toBeUndefined()
    expect(parseVersion('abc')).toBeUndefined()
  })

  it('should return undefined for empty or undefined input', () => {
    expect(parseVersion('')).toBeUndefined()
    expect(parseVersion(undefined)).toBeUndefined()
  })
})

describe(compareVersions, () => {
  it('should return 0 for equal versions', () => {
    expect(compareVersions([1, 2, 3], [1, 2, 3])).toBe(0)
  })

  it('should return -1 for a < b', () => {
    expect(compareVersions([1, 2, 3], [1, 2, 4])).toBe(-1)
    expect(compareVersions([1, 2, 3], [1, 3, 0])).toBe(-1)
    expect(compareVersions([1, 2, 3], [2, 0, 0])).toBe(-1)
  })

  it('should return 1 for a > b', () => {
    expect(compareVersions([1, 2, 4], [1, 2, 3])).toBe(1)
    expect(compareVersions([1, 3, 0], [1, 2, 3])).toBe(1)
    expect(compareVersions([2, 0, 0], [1, 2, 3])).toBe(1)
  })
})
