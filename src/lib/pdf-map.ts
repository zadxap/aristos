import type { Subject } from '@/types'

export interface PdfDocumentInfo {
  title: string
  filename: string
  url: string
}

/**
 * PDFs come only from the subject data itself (`Subject.pdfs`, editable in
 * curriculum-builder). The old bundled /pdf/ folder was moved out of the repo —
 * it contained the owner's personal course materials and must not ship with
 * the public build.
 */
export function getSubjectPdfs(subjectOrId: Subject | string): PdfDocumentInfo[] {
  if (typeof subjectOrId !== 'string' && Array.isArray(subjectOrId.pdfs)) {
    return subjectOrId.pdfs.map((document) => ({ ...document }))
  }
  return []
}
