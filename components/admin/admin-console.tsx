"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LanguageSwitcher } from "@/components/explorer/language-switcher"
import { useI18n } from "@/lib/i18n/provider"

interface PublicKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  revokedAt: string | null
}

export function AdminConsole() {
  const { t, locale } = useI18n()
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  const refreshSession = useCallback(async () => {
    const response = await fetch("/api/admin/session", { cache: "no-store" })
    const body = (await response.json()) as { authenticated?: boolean }
    setAuthenticated(Boolean(body.authenticated))
    setReady(true)
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              {t("admin.back")}
            </Link>
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{t("admin.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {authenticated ? <LogoutButton onDone={() => setAuthenticated(false)} /> : null}
        </div>
      </header>
      {!ready ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : authenticated ? (
        <KeyManager locale={locale} />
      ) : (
        <LoginCard onSuccess={() => setAuthenticated(true)} />
      )}
    </main>
  )
}

function LoginCard({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n()
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!password || pending) return
    setPending(true)
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      setPassword("")
      if (response.ok) {
        onSuccess()
        return
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      const description =
        body?.error === "INVALID_SYNC_PASSWORD"
          ? t("admin.invalidPassword")
          : body?.error === "SYNC_PASSWORD_NOT_CONFIGURED"
            ? t("admin.passwordNotConfigured")
            : body?.error === "RATE_LIMITED"
              ? t("admin.rateLimited")
              : t("admin.loginFailed")
      toast.error(description)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.loginTitle")}</CardTitle>
        <CardDescription>{t("admin.loginDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("sync.passwordPlaceholder")}
            aria-label={t("sync.passwordPlaceholder")}
            autoComplete="current-password"
            autoFocus
          />
          <Button type="submit" disabled={!password || pending}>
            {pending ? t("admin.signingIn") : t("admin.loginSubmit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function LogoutButton({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        void fetch("/api/admin/session", { method: "DELETE" }).finally(onDone)
      }}
    >
      {t("admin.logout")}
    </Button>
  )
}

function KeyManager({ locale }: { locale: string }) {
  const { t } = useI18n()
  const [keys, setKeys] = useState<PublicKey[] | null>(null)
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [freshToken, setFreshToken] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/keys", { cache: "no-store" })
    if (response.status === 401) {
      window.location.reload()
      return
    }
    if (!response.ok) {
      toast.error(t("admin.loadError"))
      setKeys([])
      return
    }
    const body = (await response.json()) as { keys: PublicKey[] }
    setKeys(body.keys)
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const response = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string; token?: string; key?: PublicKey } | null
      if (!response.ok || !body?.token || !body.key) {
        toast.error(errorText(body?.error, t))
        return
      }
      setName("")
      setFreshToken(body.token)
      setKeys((current) => [body.key as PublicKey, ...(current ?? []).filter((key) => key.id !== body.key?.id)])
    } finally {
      setPending(false)
    }
  }

  const revoke = async (key: PublicKey) => {
    if (!window.confirm(t("admin.confirmRevoke"))) return
    const response = await fetch(`/api/admin/keys/${key.id}`, { method: "DELETE" })
    const body = (await response.json().catch(() => null)) as { error?: string; key?: PublicKey } | null
    if (!response.ok || !body?.key) {
      toast.error(t("admin.revokeError"))
      return
    }
    setKeys((current) => (current ?? []).map((row) => (row.id === body.key?.id ? body.key : row)))
  }

  const copy = async () => {
    if (!freshToken) return
    await navigator.clipboard.writeText(freshToken)
    toast.success(t("admin.copied"))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.keysTitle")}</CardTitle>
          <CardDescription>{t("admin.keysDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("admin.namePlaceholder")}
              aria-label={t("admin.nameLabel")}
              maxLength={60}
            />
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? t("admin.creating") : t("admin.create")}
            </Button>
          </form>
          {freshToken ? (
            <div className="grid gap-2 rounded-lg bg-muted/60 p-3">
              <p className="text-sm">{t("admin.created")}</p>
              <code className="break-all font-mono text-xs">{freshToken}</code>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => void copy()}>
                  {t("admin.copy")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFreshToken(null)}>
                  {t("admin.dismiss")}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.usageTitle")}</CardTitle>
          <CardDescription>{t("admin.usageHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">{`curl -H "Authorization: Bearer fme_…" https://YOUR_HOST/api/v1/models`}</pre>
        </CardContent>
      </Card>

      <div className="overflow-x-auto">
        {keys === null ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.empty")}</p>
        ) : (
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">{t("admin.name")}</th>
                <th className="px-2 py-2 font-medium">{t("admin.prefix")}</th>
                <th className="px-2 py-2 font-medium">{t("admin.createdAt")}</th>
                <th className="px-2 py-2 font-medium">{t("admin.status")}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-border/60">
                  <td className="px-2 py-2">{key.name}</td>
                  <td className="px-2 py-2 font-mono text-xs">{key.prefix}…</td>
                  <td className="px-2 py-2 text-muted-foreground">{formatWhen(key.createdAt, locale)}</td>
                  <td className="px-2 py-2">{key.revokedAt ? t("admin.revoked") : t("admin.active")}</td>
                  <td className="px-2 py-2 text-right">
                    {key.revokedAt ? null : (
                      <Button type="button" size="sm" variant="destructive" onClick={() => void revoke(key)}>
                        {t("admin.revoke")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function errorText(code: string | undefined, t: (key: "admin.invalidName" | "admin.tooMany" | "admin.storeUnavailable" | "admin.createError") => string) {
  if (code === "INVALID_NAME") return t("admin.invalidName")
  if (code === "TOO_MANY_KEYS") return t("admin.tooMany")
  if (code === "KEY_STORE_UNAVAILABLE" || code === "KEY_STORE_INVALID") return t("admin.storeUnavailable")
  return t("admin.createError")
}

function formatWhen(iso: string, locale: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(locale)
}
