export function reportDownloadBasename(generatedAt: string): string {
  const date = new Date(generatedAt)
  const ymd = Number.isNaN(date.getTime()) ? "unknown-date" : date.toISOString().slice(0, 10)
  return `frontier-report-${ymd}`
}

export function downloadMarkdownFile(markdown: string, generatedAt: string): void {
  const filename = `${reportDownloadBasename(generatedAt)}.md`
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
