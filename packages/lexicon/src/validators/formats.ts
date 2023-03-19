import { ensureValidAtUri } from '@atproto/uri'
import { isValidISODateString } from 'iso-datestring-validator'
import { CID } from 'multiformats/cid'
import { ValidationResult, ValidationError } from '../types'
import { ensureValidDid, ensureValidHandle } from '@atproto/identifier'
import { ensureValidNsid } from '@atproto/nsid'

export function datetime(path: string, value: string): ValidationResult {
  try {
    if (!isValidISODateString(value)) {
      throw new Error()
    }
  } catch {
    return {
      success: false,
      error: new ValidationError(
        `${path} must be an iso8601 formatted datetime`,
      ),
    }
  }
  return { success: true, value }
}

export function uri(path: string, value: string): ValidationResult {
  const isUri = value.match(/^\w+:(?:\/\/)?[^\s/][^\s]*$/) !== null
  if (!isUri) {
    return {
      success: false,
      error: new ValidationError(`${path} must be a uri`),
    }
  }
  return { success: true, value }
}

export function atUri(path: string, value: string): ValidationResult {
  try {
    ensureValidAtUri(value)
  } catch {
    return {
      success: false,
      error: new ValidationError(`${path} must be a valid at-uri`),
    }
  }
  return { success: true, value }
}

export function did(path: string, value: string): ValidationResult {
  try {
    ensureValidDid(value)
  } catch {
    return {
      success: false,
      error: new ValidationError(`${path} must be a valid did`),
    }
  }
  return { success: true, value }
}

export function handle(path: string, value: string): ValidationResult {
  try {
    ensureValidHandle(value)
  } catch {
    return {
      success: false,
      error: new ValidationError(`${path} must be a valid handle`),
    }
  }
  return { success: true, value }
}

export function atIdentifier(path: string, value: string): ValidationResult {
  const isDid = did(path, value)
  if (!isDid.success) {
    const isHandle = handle(path, value)
    if (!isHandle.success) {
      return {
        success: false,
        error: new ValidationError(`${path} must be a valid did or a handle`),
      }
    }
  }
  return { success: true, value }
}

export function nsid(path: string, value: string): ValidationResult {
  try {
    ensureValidNsid(value)
  } catch {
    return {
      success: false,
      error: new ValidationError(`${path} must be a valid nsid`),
    }
  }
  return { success: true, value }
}

export function cid(path: string, value: string): ValidationResult {
  try {
    CID.parse(value)
  } catch {
    return {
      success: false,
      error: new ValidationError(`${path} must be a cid string`),
    }
  }
  return { success: true, value }
}
