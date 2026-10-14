import type { Metadata } from "next"
import { AdminConsole } from "@/components/admin/admin-console"
import { getRequestLocale } from "@/lib/i18n/server"
import { createTranslator } from "@/lib/i18n/translate"

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getRequestLocale())
  return { title: t("admin.title") }
}

export default function AdminPage() {
  return <AdminConsole />
}
