import { isValidISODateString } from 'iso-datestring-validator'
import { CID } from 'multiformats/cid'
import { ValidationResult, ValidationError } from '../types'
import {
  ensureValidDid,
  ensureValidHandle,
  ensureValidNsid,
  ensureValidAtUri,
} from '@atproto/syntax'
import { validateLanguage } from '@atproto/common-web'

export function datetime(path: string, value: string): ValidationResult {
  try {
    if (!isValidISODateString(value)) {
      throw new Error()
    }
  } catch {
    return {
      success: false,
      error: new ValidationError(
        `${path} must be an valid atproto datetime (both RFC-3339 and ISO-8601)`,
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

// The language format validates well-formed BCP 47 language tags: https://www.rfc-editor.org/info/bcp47
export function language(path: string, value: string): ValidationResult {
  if (validateLanguage(value)) {
    return { success: true, value }
  }
  return {
    success: false,
    error: new ValidationError(
      `${path} must be a well-formed BCP 47 language tag`,
    ),
  }
}
