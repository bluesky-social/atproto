import { capabilities, Capability, CapabilitySemantics, CapabilityEscalation, Chained } from "ucans"

export interface TwitterCapability {
  twitter: string
  cap: "POST"
}

export const twitterSemantics: CapabilitySemantics<TwitterCapability> = {

  tryParsing(cap: Capability): TwitterCapability | null {
    if (typeof cap.twitter === "string" && cap.cap === "POST") {
      return {
        twitter: cap.twitter,
        cap: cap.cap,
      }
    }
    return null
  },

  tryDelegating<T extends TwitterCapability>(parentCap: T, childCap: T): T | null | CapabilityEscalation<TwitterCapability> {
    // potency is always "POST" for now, so doesn't need to be checked
    return childCap.twitter === parentCap.twitter ? childCap : null
  },

}

export function twitterCapabilities(ucan: Chained) {
  return capabilities(ucan, twitterSemantics)
}
