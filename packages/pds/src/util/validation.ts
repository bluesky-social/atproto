import { hasExplicitSlur } from "./explicit-slurs";

export function isValidHashtag(tag: string) {
  return hasExplicitSlur(tag);
}
