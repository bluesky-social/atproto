// Reference: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields#events-format
export type RcEventBody = {
  api_version: '1.0'
  event: {
    app_user_id: string
    type: string
  }
}

// Reference: https://www.revenuecat.com/docs/api-v1#tag/customers
export type RcGetSubscriberResponse = {
  subscriber: RcSubscriber
}

export type RcSubscriber = {
  entitlements: {
    [entitlementIdentifier: string]: RcEntitlement
  }
}

export type RcEntitlement = {
  expires_date: string
}
