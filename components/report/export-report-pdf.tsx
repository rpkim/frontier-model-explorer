"use client"

import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { ReportPdfDocument } from "@/components/report/report-pdf-document"

const A4_WIDTH_PX = 794
const MAX_CANVAS_EDGE = 8192

export async function exportReportPdf({
  markdown,
  title,
  meta,
  model,
  filename,
}: {
  markdown: string
  title: string
  meta: string
  model: string
  filename: string
}): Promise<void> {
  const host = document.createElement("div")
  host.setAttribute("aria-hidden", "true")
  host.style.cssText = `position:fixed;left:-12000px;top:0;width:${A4_WIDTH_PX}px;pointer-events:none;`
  document.body.appendChild(host)

  const root = createRoot(host)
  try {
    flushSync(() => {
      root.render(<ReportPdfDocument markdown={markdown} title={title} meta={meta} model={model} />)
    })

    const target = host.querySelector("[data-report-pdf]")
    if (!(target instanceof HTMLElement)) {
      throw new Error("PDF source missing")
    }

    if (document.fonts?.ready) {
      await document.fonts.ready
    }

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ])

    const scale = Math.min(2, MAX_CANVAS_EDGE / Math.max(target.scrollHeight, 1))
    const canvas = await html2canvas(target, {
      scale: Math.max(1, scale),
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: A4_WIDTH_PX,
      onclone(clonedDoc) {
        clonedDoc.documentElement.style.background = "#ffffff"
        clonedDoc.documentElement.style.color = "#1f2937"
        clonedDoc.body.style.background = "#ffffff"
        clonedDoc.body.style.color = "#1f2937"
      },
    })

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("empty canvas")
    }

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    pdf.setProperties({ title, creator: title })

    let y = 0
    let remaining = imgHeight
    pdf.addImage(canvas, "JPEG", 0, y, imgWidth, imgHeight, undefined, "FAST")
    remaining -= pageHeight

    while (remaining > 1) {
      y -= pageHeight
      pdf.addPage()
      pdf.addImage(canvas, "JPEG", 0, y, imgWidth, imgHeight, undefined, "FAST")
      remaining -= pageHeight
    }

    pdf.save(filename)
  } finally {
    root.unmount()
    host.remove()
  }
}
