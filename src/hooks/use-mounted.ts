import { useSyncExternalStore } from "react"

function noopSubscribe(): () => void {
  return () => {}
}

/** True on the client; false when rendering without a DOM (e.g. SSR snapshot). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}
