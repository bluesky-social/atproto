import { readFileSync } from 'node:fs'
import { checkServerIdentity } from 'node:tls'
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'
import { Signer, type SignerConfig } from '@aws-sdk/rds-signer'
import type { PoolConfig } from 'pg'

export type PgAwsIamAuthOptions = {
  /** Defaults to `AWS_REGION`, then to the region of an `*.rds.amazonaws.com` host. */
  region?: string
  /** Defaults to the AWS SDK's default provider chain, shared by the process. */
  credentials?: SignerConfig['credentials']
  /** Defaults to the Amazon RDS global CA bundle shipped with this package. */
  ca?: string
}

/**
 * Builds node-postgres pool options that authenticate with a fresh AWS RDS IAM
 * auth token for every new connection, over TLS that verifies the server
 * certificate and hostname. Throws if `url` contains a password or parameters
 * that would weaken either.
 */
export function pgAwsIamAuthConfig(
  url: string,
  opts: PgAwsIamAuthOptions = {},
): PoolConfig {
  const { host, port, user, database } = parsePostgresUrl(url)
  const region =
    opts.region || process.env.AWS_REGION || regionFromRdsHostname(host)
  if (!region) {
    throw new Error(
      'AWS IAM database auth: set AWS_REGION, as the region cannot be derived from the database hostname',
    )
  }
  const signer = new Signer({
    hostname: host,
    port,
    username: user,
    region,
    credentials: opts.credentials ?? getDefaultCredentials(),
  })
  // @NOTE No connectionString: node-postgres merges its parameters over the
  // explicit options, which would replace the ssl and password set here.
  return {
    host,
    port,
    user,
    database,
    password: () => signer.getAuthToken(),
    ssl: {
      ca: opts.ca ?? readRdsCaBundle(),
      rejectUnauthorized: true,
      // @NOTE node-postgres sets no servername for an IP host, and node then
      // checks the certificate against "localhost".
      checkServerIdentity: (_, cert) => checkServerIdentity(host, cert),
    },
  }
}

let defaultCredentials: SignerConfig['credentials']
function getDefaultCredentials() {
  defaultCredentials ??= fromNodeProviderChain()
  return defaultCredentials
}

function readRdsCaBundle() {
  // https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
  return readFileSync(
    new URL('../../certs/rds-global-bundle.pem', import.meta.url),
    'utf8',
  )
}

function parsePostgresUrl(str: string) {
  let url: URL
  try {
    url = new URL(str)
  } catch {
    throw new Error('AWS IAM database auth: the postgres URL is invalid')
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(
      'AWS IAM database auth: the postgres URL must use the postgres: or postgresql: scheme',
    )
  }
  if (url.password) {
    throw new Error(
      'AWS IAM database auth: the postgres URL must not contain a password, the IAM auth token is the password',
    )
  }
  for (const [key, value] of url.searchParams) {
    if (key === 'sslmode' && value === 'verify-full') continue
    if (key.startsWith('ssl') || key === 'uselibpqcompat') {
      throw new Error(
        `AWS IAM database auth: the postgres URL parameter "${key}" conflicts with TLS verification against the RDS CA bundle (only sslmode=verify-full is accepted)`,
      )
    }
    throw new Error(
      `AWS IAM database auth: the postgres URL parameter "${key}" is not supported`,
    )
  }
  // An IPv6 address keeps its brackets in URL.hostname
  const host = decodeURIComponent(url.hostname).replace(/^\[(.*)\]$/, '$1')
  if (!host || host.startsWith('/')) {
    throw new Error(
      'AWS IAM database auth: the postgres URL must name a TCP host',
    )
  }
  const user = decodeURIComponent(url.username)
  if (!user) {
    throw new Error('AWS IAM database auth: the postgres URL must name a user')
  }
  const database = decodeURIComponent(url.pathname.slice(1)) || undefined
  const port = url.port ? Number(url.port) : 5432
  return { host, port, user, database }
}

const RDS_HOSTNAME_REGION =
  /\.([a-z]{2}(?:-[a-z]+)+-\d+)\.rds\.amazonaws\.com(?:\.cn)?$/

export function regionFromRdsHostname(host: string): string | undefined {
  return RDS_HOSTNAME_REGION.exec(host.toLowerCase())?.[1]
}
