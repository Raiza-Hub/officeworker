import * as React from "react"

function readIsDarkTheme() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  )
}

function subscribeToDarkTheme(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

export function useIsDarkTheme() {
  return React.useSyncExternalStore(subscribeToDarkTheme, readIsDarkTheme, () => false)
}
