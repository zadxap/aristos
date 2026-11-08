import { useState } from "react"
import type { PdfDocumentInfo } from "@/lib/pdf-map"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { kk } from "@/i18n"
import { FileText, ExternalLink, Eye, Download } from "lucide-react"

interface PdfDocumentsProps {
  documents: PdfDocumentInfo[]
}

export function PdfDocuments({ documents }: PdfDocumentsProps) {
  const [selectedPdf, setSelectedPdf] = useState<PdfDocumentInfo | null>(null)

  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-12 text-center">
        <FileText className="mx-auto mb-2 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">{kk.noPdfs}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{kk.noPdfLinks}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5">
        {documents.map((doc, idx) => (
          <Card
            key={`${doc.filename}-${idx}`}
            className="min-w-0 shadow-xs transition-all hover:border-primary/50"
          >
            <CardContent className="flex min-w-0 flex-col items-stretch gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold break-words text-foreground sm:line-clamp-2 sm:text-sm">
                    {doc.title}
                  </h4>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {doc.filename}
                  </p>
                </div>
              </div>

              <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto sm:shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPdf(doc)}
                  aria-label={`${kk.viewDocument}: ${doc.title}`}
                  className="h-9 min-w-0 gap-1.5 px-3 text-xs"
                >
                  <Eye className="size-3.5" />
                  <span>{kk.view}</span>
                </Button>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={kk.openNewWindow}
                  aria-label={`${kk.openNewWindow}: ${doc.title}`}
                >
                  <ExternalLink className="size-3.5" />
                  <span>{kk.pdfOpen}</span>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* In-app PDF Viewer Modal */}
      {selectedPdf && (
        <Modal
          isOpen={!!selectedPdf}
          onClose={() => setSelectedPdf(null)}
          title={selectedPdf.title}
          description={selectedPdf.filename}
          className="max-h-[90dvh] w-full max-w-4xl"
        >
          <div className="h-[58dvh] min-h-0 w-full shrink overflow-hidden rounded-xl border border-border/80 bg-muted/20 sm:h-[66dvh]">
            <iframe
              src={`${selectedPdf.url}#view=FitH`}
              title={selectedPdf.title}
              className="h-full w-full border-0"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={selectedPdf.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" />
                {kk.openSeparatePage}
              </a>
              <a
                href={selectedPdf.url}
                download={selectedPdf.filename}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3.5" />
                {kk.downloadFile}
              </a>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPdf(null)}
            >
              {kk.close}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
