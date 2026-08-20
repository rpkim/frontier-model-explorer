"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/lib/i18n/provider"

export function PasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  pending = false,
  title,
  description,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (password: string) => void
  pending?: boolean
  title?: string
  description?: string
}) {
  const [password, setPassword] = useState("")
  const { t } = useI18n()

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) setPassword("")
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const submitted = password
    if (!submitted || pending) return
    setPassword("")
    onOpenChange(false)
    onSubmit(submitted)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title ?? t("sync.passwordTitle")}</DialogTitle>
            <DialogDescription>{description ?? t("sync.passwordDescription")}</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("sync.passwordPlaceholder")}
            aria-label={t("sync.passwordPlaceholder")}
            autoComplete="current-password"
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t("sync.passwordCancel")}
            </Button>
            <Button type="submit" disabled={!password || pending}>
              {t("sync.passwordConfirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
