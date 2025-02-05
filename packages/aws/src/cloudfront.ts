import * as aws from '@aws-sdk/client-cloudfront'
import { ImageInvalidator } from './types'

export type CloudfrontConfig = {
  distributionId: string
  pathPrefix?: string
} & Omit<aws.CloudFrontClientConfig, 'apiVersion'>

export class CloudfrontInvalidator implements ImageInvalidator {
  distributionId: string
  pathPrefix: string
  client: aws.CloudFront
  constructor(cfg: CloudfrontConfig) {
    const { distributionId, pathPrefix, ...rest } = cfg
    this.distributionId = distributionId
    this.pathPrefix = pathPrefix ?? ''
    this.client = new aws.CloudFront({
      ...rest,
      apiVersion: '2020-05-31',
    })
  }
  async invalidate(subject: string, paths: string[]) {
    await this.client.createInvalidation({
      DistributionId: this.distributionId,
      InvalidationBatch: {
        CallerReference: `cf-invalidator-${subject}-${Date.now()}`,
        Paths: {
          Quantity: paths.length,
          Items: paths.map((path) => this.pathPrefix + path),
        },
      },
    })
  }
}

export default CloudfrontInvalidator
