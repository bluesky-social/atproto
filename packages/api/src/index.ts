import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { AdxUri, resolveName } from '@adxp/common'
import * as auth from '@adxp/auth'
import { AdxSchemas, AdxRecordValidator, AdxViewValidator } from '@adxp/schemas'
import * as t from './types'
import * as err from './errors'
import * as ht from './http-types'

export type QP = Record<string, any> | URLSearchParams

export enum PdsEndpoint {
  GetDid,
  Account,
  Session,
  Repo,
  RepoCollection,
  RepoRecord,
  View,
}

export class AdxClient {
  private _mainPds: AdxPdsClient | undefined

  /**
   * The default PDS to transact with. Configured with configure().
   */
  get mainPds(): AdxPdsClient {
    if (!this._mainPds) {
      throw new Error(`No PDS configured`)
    }
    return this._mainPds
  }

  /**
   * Schemas used for validating records and views.
   */
  schemas = new AdxSchemas()

  constructor(opts: t.AdxClientOpts) {
    this.configure(opts)
  }

  /**
   * Configure the client.
   */
  configure(opts: t.AdxClientOpts) {
    if (opts.pds) {
      this._mainPds = this.pds(opts.pds)
    }
    if (opts.schemas) {
      this.schemas.schemas = new Map() // reset
      for (const schema of opts.schemas) {
        this.schemas.add(schema)
      }
    }
    if (opts.locale) {
      this.schemas.locale = opts.locale
    }
  }

  /**
   * Instantiates an AdxPdsClient object.
   */
  pds(url: string) {
    return new AdxPdsClient(this, url)
  }

  /**
   * Instantiates an AdxRepoClient object.
   */
  repo(did: string, authStore?: auth.AuthStore): AdxRepoClient {
    return this.mainPds.repo(did, authStore)
  }

  /**
   * Instantiates a validator for one or more schemas.
   */
  schema(schema: t.SchemaOpt): AdxRecordValidator {
    return getRecordValidator(schema, this)
  }
}

/**
 * ADX API.
 */
export const adx = new AdxClient({})

export class AdxPdsClient {
  origin: string
  private _did: string | undefined
  constructor(public client: AdxClient, url: string) {
    this.origin = new URL(url).origin
  }

  /**
   * Instantiates an AdxRepoClient object.
   */
  repo(did: string, authStore?: auth.AuthStore): AdxRepoClient {
    return new AdxRepoClient(this, did, authStore)
  }

  /**
   * Registers a repository with a PDS.
   */
  async registerRepo(params: t.RegisterRepoParams): Promise<AdxRepoClient> {
    // const pdsDid = await this.getDid()
    // const token = await params.authStore.createUcan(
    //   pdsDid,
    //   auth.maintenanceCap(params.did),
    // )
    const reqBody = {
      did: params.did,
      username: params.username,
    }
    await axios
      .post(this.url(PdsEndpoint.Account), reqBody, requestCfg(params.did))
      .catch(toAPIError)
    return new AdxRepoClient(this, params.did)
  }

  /**
   * Query a view.
   */
  async view(view: string, did: string, params: QP) {
    const validator = getViewValidator(view, this.client)
    // TODO - validate params?
    const res = await axios
      .get(this.url(PdsEndpoint.View, [view], params), requestCfg(did))
      .catch(toAPIError)

    validator.assertResponseValid(res.data)
    return res.data
  }

  /**
   * Get the PDS's DID.
   */
  async getDid(): Promise<string> {
    if (this._did) return this._did
    const did = (this._did = await resolveName(new URL(this.origin).hostname))
    return did
  }

  /**
   * Construct the URL for a known endpoint.
   */
  url(endpoint: PdsEndpoint, params?: any[], qp?: QP): string {
    let pathname: string
    switch (endpoint) {
      case PdsEndpoint.GetDid:
        if (params?.length) throw new Error('0 URL parameters expected')
        pathname = '/.well-known/adx-did'
        break
      case PdsEndpoint.Account:
        if (params?.length) throw new Error('0 URL parameters expected')
        pathname = '/.adx/v1/account'
        break
      case PdsEndpoint.Session:
        if (params?.length) throw new Error('0 URL parameters expected')
        pathname = '/.adx/v1/session'
        break
      case PdsEndpoint.Repo:
        if (params?.length !== 1) throw new Error('1 URL parameter expected')
        pathname = `/.adx/v1/api/repo/${params?.[0]}`
        break
      case PdsEndpoint.RepoCollection:
        if (params?.length !== 2) throw new Error('2 URL parameters expected')
        pathname = `/.adx/v1/api/repo/${params?.[0]}/c/${params?.[1]}`
        break
      case PdsEndpoint.RepoRecord:
        if (params?.length !== 3) throw new Error('3 URL parameters expected')
        pathname = `/.adx/v1/api/repo/${params?.[0]}/c/${params?.[1]}/r/${params?.[2]}`
        break
      case PdsEndpoint.View:
        if (params?.length !== 1) throw new Error('1 URL parameter expected')
        pathname = `/.adx/v1/api/view/${params?.[0]}`
        break
      default:
        throw new Error(`Unsupported endpoint code: ${endpoint}`)
    }
    let url = this.origin + (pathname || '')
    if (qp) {
      if (!(qp instanceof URLSearchParams)) {
        const safeParams = {}
        for (const entry of Object.entries(qp)) {
          if (entry[1] !== undefined) {
            safeParams[entry[0]] = encodeURIComponent(entry[1])
          }
        }
        qp = new URLSearchParams(safeParams)
      }
      url += '?' + qp.toString()
    }
    return url
  }
}

export class AdxRepoClient {
  constructor(
    public pds: AdxPdsClient,
    public did: string,
    public authStore?: auth.AuthStore,
  ) {}

  get writable() {
    return !this.authStore
  }

  /**
   * Describe the repo.
   */
  async describe(
    params?: ht.DescribeRepoParams,
  ): Promise<ht.DescribeRepoResponse> {
    const res = await axios
      .get(this.pds.url(PdsEndpoint.Repo, [this.did], params))
      .catch(toAPIError)
    return ht.describeRepoResponse.parse(res.data)
  }

  /**
   * Instantiates a AdxRepoCollectionClient object.
   */
  collection(collectionId: string) {
    return new AdxRepoCollectionClient(this, collectionId)
  }

  /**
   * Execute a batch of writes. WARNING: does not validate schemas!
   */
  async _batchWrite(writes: t.BatchWrite[]): Promise<void> {
    if (!this.writable || !this.authStore) {
      throw new err.WritePermissionError()
    }
    const body = ht.batchWriteParams.parse({ writes })
    await axios
      .post(this.pds.url(PdsEndpoint.Repo, [this.did]), body)
      .catch(toAPIError)
  }
}

class AdxRepoCollectionClient {
  constructor(public repo: AdxRepoClient, public id: string) {}

  /**
   * List the records in the repo collection.
   */
  async list(
    schema: t.SchemaOpt,
    params?: ht.ListRecordsParams,
  ): Promise<ht.ListRecordsResponse> {
    const url = this.repo.pds.url(
      PdsEndpoint.RepoCollection,
      [this.repo.did, this.id],
      params,
    )
    const res = await axios.get(url).catch(toAPIError)
    const resSafe = ht.listRecordsResponse.parse(res.data)
    if (schema === '*') {
      return resSafe
    }
    const validator = getRecordValidator(schema, this.repo.pds.client)
    return {
      records: resSafe.records.map((record) => {
        const validation = validator.validate(record.value)
        return {
          key: record.key,
          value: record.value,
          valid: validation.valid,
          fullySupported: validation.fullySupported,
          compatible: validation.compatible,
          error: validation.error,
          fallbacks: validation.fallbacks,
        }
      }),
    }
  }

  /**
   * Get a record in the repo.
   */
  async get(
    schema: t.SchemaOpt,
    key: string,
  ): Promise<t.GetRecordResponseValidated> {
    const url = this.repo.pds.url(PdsEndpoint.RepoRecord, [
      this.repo.did,
      this.id,
      key,
    ])
    const res = await axios.get(url).catch(toAPIError)
    const resSafe = ht.getRecordResponse.parse(res.data)
    if (schema === '*') {
      return resSafe
    }
    const validator = getRecordValidator(schema, this.repo.pds.client)
    const validation = validator.validate(resSafe.value)
    return {
      key: resSafe.key,
      value: resSafe.value,
      valid: validation.valid,
      fullySupported: validation.fullySupported,
      compatible: validation.compatible,
      error: validation.error,
      fallbacks: validation.fallbacks,
    }
  }

  /**
   * Create a new record.
   */
  async create(schema: t.SchemaOpt, value: any): Promise<AdxUri> {
    if (!this.repo.writable) {
      throw new err.WritePermissionError()
    }
    if (schema !== '*') {
      const validator = getRecordValidator(schema, this.repo.pds.client)
      validator.assertValid(value)
    }
    const url = this.repo.pds.url(
      PdsEndpoint.RepoCollection,
      [this.repo.did, this.id],
      { verified: true },
    )
    const res = await axios.post(url, value).catch(toAPIError)
    const { uri } = ht.createRecordResponse.parse(res.data)
    return new AdxUri(uri)
  }

  /**
   * Write the record.
   */
  async put(schema: t.SchemaOpt, key: string, value: any) {
    if (!this.repo.writable) {
      throw new err.WritePermissionError()
    }
    if (schema !== '*') {
      const validator = getRecordValidator(schema, this.repo.pds.client)
      validator.assertValid(value)
    }
    const url = this.repo.pds.url(
      PdsEndpoint.RepoRecord,
      [this.repo.did, this.id, key],
      { verified: true },
    )
    const res = await axios.put(url, value).catch(toAPIError)
    const { uri } = ht.createRecordResponse.parse(res.data)
    return new AdxUri(uri)
  }

  /**
   * Delete the record.
   */
  async del(key: string) {
    if (!this.repo.writable) {
      throw new err.WritePermissionError()
    }
    const url = this.repo.pds.url(
      PdsEndpoint.RepoRecord,
      [this.repo.did, this.id, key],
      { verified: true },
    )
    await axios.delete(url).catch(toAPIError)
  }
}

function requestCfg(did?: string): AxiosRequestConfig {
  // @TODO add back in real auth
  const headers: Record<string, string> = {}
  if (did) {
    headers['Authorization'] = did
  }
  // if (token) {
  //   headers['Authorization'] = `Bearer ${auth.encodeUcan(token)}`
  // }

  return { headers }
}

function toAPIError(error: AxiosError): AxiosResponse {
  throw new err.APIResponseError(
    error.response?.status || 0,
    error.response?.statusText || 'Request failed',
    error.response?.headers,
    error.response?.data,
  )
}

function getRecordValidator(schema: t.SchemaOpt, client: AdxClient) {
  return schema instanceof AdxRecordValidator
    ? schema
    : client.schemas.createRecordValidator(schema)
}

function getViewValidator(
  schema: string | AdxViewValidator,
  client: AdxClient,
) {
  return schema instanceof AdxViewValidator
    ? schema
    : client.schemas.createViewValidator(schema)
}

export * as did from '@adxp/did-sdk'
export { resolveName, AdxUri } from '@adxp/common'
export * from './types'
export * from './http-types'
export * from './errors'
