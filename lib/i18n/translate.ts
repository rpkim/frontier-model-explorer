import { messages } from "./messages"
import type { Locale } from "./locales"

export type Messages = typeof messages.en

type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? LeafPaths<T[K], `${Prefix}${K}.`>
      : never
}[keyof T & string]

export type MessageKey = LeafPaths<Messages>

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string

function getPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".")
  let cur: unknown = obj
  for (const part of parts) {
    if (typeof cur !== "object" || cur === null || !(part in cur)) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === "string" ? cur : undefined
}

export function createTranslator(locale: Locale): TFunction {
  const dict = messages[locale]
  return (key, vars) => {
    let str = getPath(dict, key) ?? getPath(messages.en, key) ?? key
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        str = str.replaceAll(`{${name}}`, String(value))
      }
    }
    return str
  }
}
