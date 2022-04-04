import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosRequestHeaders,
} from 'axios'
import * as ucan from 'ucans'

export const assureAxiosError = (err: unknown): AxiosError => {
  if (axios.isAxiosError(err)) return err
  throw err
}

export const authHeader = (token: ucan.Chained): AxiosRequestHeaders => {
  return {
    Authorization: `Bearer ${token.encoded()}`,
  }
}

export const authCfg = (token: ucan.Chained): AxiosRequestConfig => {
  return {
    headers: authHeader(token),
  }
}
