"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { BotMessageSquareIcon, LoaderCircleIcon, SendIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { AgentMarkdown } from "@/components/agent/agent-markdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"

const EXAMPLE_KEYS = [
  "agent.exampleCheapest",
  "agent.exampleFastest",
  "agent.exampleCompare",
  "agent.exampleNewest",
] as const

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
}

function parseAgentErrorCode(error: Error): "LLM_KEY_MISSING" | "NO_SNAPSHOT" | "UNKNOWN" {
  const raw = error.message.trim()
  if (raw === "LLM_KEY_MISSING" || raw === "NO_SNAPSHOT") return raw
  try {
    const parsed = JSON.parse(raw) as { error?: string }
    if (parsed.error === "LLM_KEY_MISSING" || parsed.error === "NO_SNAPSHOT") return parsed.error
  } catch {
    // The transport surfaces the raw response body; ignore non-JSON payloads.
  }
  return "UNKNOWN"
}

export function AgentWidget({ hasSnapshot }: { hasSnapshot: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/agent" }), [])
  const { messages, sendMessage, status, error, clearError } = useChat({ transport })

  const busy = status === "submitted" || status === "streaming"
  const waitingForReply = status === "submitted"

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages, status, error, open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const errorCode = error ? parseAgentErrorCode(error) : null
  const errorText =
    errorCode === "LLM_KEY_MISSING"
      ? t("agent.errorMissingKey", { env: "GOOGLE_GENERATIVE_AI_API_KEY" })
      : errorCode === "NO_SNAPSHOT"
        ? t("agent.errorNoSnapshot")
        : errorCode
          ? t("agent.errorGeneric")
          : null

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    clearError()
    setInput("")
    void sendMessage({ text: trimmed })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit(input)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit(input)
    }
  }

  return (
    <div
      className="pointer-events-none fixed z-40 flex flex-col items-end gap-3"
      style={{
        bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
        right: "max(1.25rem, env(safe-area-inset-right, 0px))",
      }}
    >
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="agent-panel-title"
          className="pointer-events-auto flex h-[min(70dvh,36rem)] w-[min(calc(100vw-2.5rem),24rem)] flex-col overflow-hidden rounded-xl bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10"
        >
          <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                <BotMessageSquareIcon className="size-4" />
              </div>
              <h2 id="agent-panel-title" className="truncate text-sm font-medium">
                {t("agent.title")}
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label={t("agent.close")}
            >
              <XIcon />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 px-3 py-3">
              {messages.length === 0 && (
                <div className="flex flex-col gap-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    {hasSnapshot ? t("agent.emptyHint") : t("agent.errorNoSnapshot")}
                  </p>
                  {hasSnapshot && (
                    <div className="flex flex-col gap-1.5">
                      {EXAMPLE_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                          onClick={() => submit(t(key))}
                          disabled={busy}
                        >
                          {t(key)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((message) => {
                const text = messageText(message)
                if (!text && message.role === "assistant" && busy) return null
                if (!text) return null
                const isUser = message.role === "user"
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                      isUser
                        ? "ml-auto whitespace-pre-wrap bg-primary text-primary-foreground"
                        : "mr-auto bg-muted text-foreground",
                    )}
                  >
                    {isUser ? text : <AgentMarkdown text={text} />}
                  </div>
                )
              })}

              {waitingForReply && (
                <div className="mr-auto flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  {t("agent.sending")}
                </div>
              )}

              {errorText && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {errorText}
                </p>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border p-2.5">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("agent.placeholder")}
              aria-label={t("agent.placeholder")}
              disabled={busy}
              autoFocus
              autoComplete="off"
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label={t("agent.send")}>
              <SendIcon />
            </Button>
          </form>
        </section>
      )}

      {!open && (
        <Button
          type="button"
          size="lg"
          className="pointer-events-auto h-11 gap-2 rounded-full px-4 shadow-lg"
          onClick={() => setOpen(true)}
          aria-label={t("agent.button")}
        >
          <BotMessageSquareIcon data-icon="inline-start" />
          {t("agent.button")}
        </Button>
      )}
    </div>
  )
}
