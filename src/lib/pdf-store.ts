import { getDB } from './db'

/**
 * Оффлайн-PDF: юзер загружает PDF-файлы для пәна прямо в приложение,
 * они хранятся блобами в IndexedDB (стор `pdfFiles`) — только в его
 * браузере, доступны оффлайн, в бекап/деплой/git не попадают.
 *
 * ВАЖНО: блобы сознательно НЕ включаются в бекап/экспорт (src/lib/backup.ts).
 * Решение: бекап — это компактный JSON для переноса данных между устройствами,
 * а УМКД-файлы весят десятки МБ и являются приватными материалами (как и
 * former public/pdf/) — их нельзя тащить в экспорт-файлы и git. Поэтому
 * backup.ts не знает об этом сторе; после restore на новом устройстве
 * PDF-файлы загружаются заново через «Өңдеу → PDF таңдау».
 */

export interface PdfFileMeta {
  /** "${subject_id}:${filename}" */
  id: string
  subject_id: string
  /** имя файла без расширения */
  title: string
  filename: string
  size: number
  type: string
  /** ISO-дата добавления */
  addedAt: string
}

/** Полная запись в IndexedDB: метаданные + сам блоб. */
export interface PdfFileRecord extends PdfFileMeta {
  blob: Blob
}

export function pdfFileId(subjectId: string, filename: string): string {
  return `${subjectId}:${filename}`
}

function toMeta(record: PdfFileRecord): PdfFileMeta {
  return {
    id: record.id,
    subject_id: record.subject_id,
    title: record.title,
    filename: record.filename,
    size: record.size,
    type: record.type,
    addedAt: record.addedAt,
  }
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

/** Метаданные PDF пәна (без блобов), отсортированные по дате добавления. */
export async function listSubjectPdfs(subjectId: string): Promise<PdfFileMeta[]> {
  const db = await getDB()
  const all = await db.getAll('pdfFiles')
  return all
    .filter((record) => record.subject_id === subjectId)
    .map(toMeta)
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
}

/**
 * Сохраняет файлы для пәна. title = имя файла без расширения.
 * Дубликат (тот же subject_id + filename) перезаписывается (put по id).
 * Возвращает количество сохранённых файлов (не-PDF игнорируются).
 */
export async function savePdfFiles(subjectId: string, files: File[]): Promise<number> {
  const pdfs = files.filter(isPdf)
  if (pdfs.length === 0) return 0
  const db = await getDB()
  const tx = db.transaction('pdfFiles', 'readwrite')
  await Promise.all([
    ...pdfs.map((file) =>
      tx.store.put({
        id: pdfFileId(subjectId, file.name),
        subject_id: subjectId,
        title: file.name.replace(/\.[^.]+$/, ''),
        filename: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        addedAt: new Date().toISOString(),
        blob: file,
      } satisfies PdfFileRecord),
    ),
    tx.done,
  ])
  return pdfs.length
}

export async function deletePdfFile(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pdfFiles', id)
}

/** Блоб по требованию (для открытия в новой вкладке). */
export async function getPdfBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB()
  const record = await db.get('pdfFiles', id)
  return record?.blob
}
