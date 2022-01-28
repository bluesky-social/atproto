import { capabilities, Capability, CapabilitySemantics, CapabilityEscalation, Chained } from "ucans"

export interface BlueskyCapability {
  bluesky: string
  cap: "POST"
}

export const blueskySemantics: CapabilitySemantics<BlueskyCapability> = {

  tryParsing(cap: Capability): BlueskyCapability | null {
    if (typeof cap.bluesky === "string" && cap.cap === "POST") {
      return {
        bluesky: cap.bluesky,
        cap: cap.cap,
      }
    }
    return null
  },

  tryDelegating<T extends BlueskyCapability>(parentCap: T, childCap: T): T | null | CapabilityEscalation<BlueskyCapability> {
    // potency is always "POST" for now, so doesn't need to be checked
    return childCap.bluesky === parentCap.bluesky ? childCap : null
  },

}

export function blueskyCapabilities(ucan: Chained) {
  return capabilities(ucan, blueskySemantics)
}
