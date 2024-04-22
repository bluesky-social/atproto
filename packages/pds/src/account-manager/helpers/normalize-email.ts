// Sourced from: https://github.com/johno/normalize-email

const PLUS_ONLY = /\+.*$/
const PLUS_AND_DOT = /\.|\+.*$/g
const normalizeableProviders = {
  'gmail.com': {
    cut: PLUS_AND_DOT,
  },
  'googlemail.com': {
    cut: PLUS_AND_DOT,
    aliasOf: 'gmail.com',
  },
  'hotmail.com': {
    cut: PLUS_ONLY,
  },
  'live.com': {
    cut: PLUS_AND_DOT,
  },
  'outlook.com': {
    cut: PLUS_ONLY,
  },
}

export function normalizeEmail(email) {
  if (typeof email != 'string') {
    return ''
  }

  const normalized = email.toLowerCase()
  const emailParts = normalized.split(/@/)

  if (emailParts.length !== 2) {
    return email
  }

  let username = emailParts[0]
  let domain = emailParts[1]

  if (normalizeableProviders[domain]) {
    if (normalizeableProviders[domain]['cut']) {
      username = username.replace(normalizeableProviders[domain].cut, '')
    }
    if (normalizeableProviders[domain]['aliasOf']) {
      domain = normalizeableProviders[domain].aliasOf
    }
  } else {
    username = username.replace(PLUS_AND_DOT, '')
  }

  return username + '@' + domain
}
