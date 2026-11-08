import { useRef, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { kk } from '@/i18n'
import { newGpaRowId, parseNum, type GpaRow } from './gpa-scale'

/** Разбор таблицы транскрипта Платонуса (v7 → Транскрипт) из буфера обмена.
 *  Работает и с text/html (копирование таблицы из браузера), и с TSV/plain.
 *  Колонки определяются по строке заголовка (НАИМЕНОВАНИЕ / КРЕДИТОВ / ПРОЦЕНТАХ),
 *  с откатом на фиксированные позиции 1/3/4. */
export function parseTranscriptText(text: string): GpaRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '')
  if (lines.length === 0) return []

  let rows = lines.map((line) => line.split('\t').map((c) => c.trim()))
  // без табов — пробуем разделить по 2+ пробелам (копирование сетки без TSV)
  if (rows.every((r) => r.length === 1)) {
    rows = lines.map((line) => line.split(/\s{2,}/).map((c) => c.trim()))
  }

  // колонки по заголовку
  let nameIdx = 1
  let creditsIdx = 3
  let percentIdx = 4
  for (const cells of rows) {
    const lower = cells.map((c) => c.toLowerCase())
    const at = (needles: string[]) => lower.findIndex((c) => needles.some((n) => c.includes(n)))
    const nameAt = at(['наименование', 'дисциплин', 'пән атауы', 'пән'])
    const creditsAt = at(['кредит'])
    const percentAt = at(['процент', 'пайыз'])
    if (nameAt !== -1 && creditsAt !== -1 && percentAt !== -1 && creditsAt !== nameAt) {
      nameIdx = nameAt
      creditsIdx = creditsAt
      percentIdx = percentAt
      break
    }
  }

  const out: GpaRow[] = []
  const seen = new Set<string>()
  for (const cells of rows) {
    if (cells.length <= Math.max(nameIdx, creditsIdx)) continue
    const name = (cells[nameIdx] ?? '').replace(/\s+/g, ' ').trim()
    const credits = parseNum(cells[creditsIdx] ?? '')
    const percentRaw = (cells[percentIdx] ?? '').replace(',', '.').trim()
    const percent = parseNum(percentRaw)
    // данные: имя осмысленное, кредиты числом 0–30; заголовки/итоги отсеиваются
    if (name.length < 3 || credits === null || credits <= 0 || credits > 30) continue
    if (/^[№\d.]*$/.test(name)) continue // колонка «№» вместо названия
    const key = name.toLowerCase() + '|' + (cells[creditsIdx] ?? '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: newGpaRowId(),
      name,
      credits: String(credits),
      percent: percent !== null ? String(percent) : '',
      forecast: '',
      include: true,
    })
  }
  return out
}

interface TranscriptImportProps {
  onImport: (rows: GpaRow[]) => void
}

export function TranscriptImport({ onImport }: TranscriptImportProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const openModal = () => {
    setText('')
    setMessage(null)
    setOpen(true)
  }

  // Вставка HTML-таблицы из браузера: сводим к TSV, чтобы пользователь видел результат
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = event.clipboardData.getData('text/html')
    if (!html) return // обычный текст вставится сам
    event.preventDefault()
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const trs = [...doc.querySelectorAll('tr')]
      const lines = trs
        .map((tr) => [...tr.children].map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()).join('\t'))
        .filter((line) => line.replace(/\t/g, '').trim() !== '')
      const tsv = lines.join('\n')
      setText(tsv || event.clipboardData.getData('text/plain'))
      setMessage(null)
    } catch {
      // не удалось разобрать HTML — пусть вставится как есть
    }
  }

  const apply = () => {
    const parsed = parseTranscriptText(text)
    if (parsed.length === 0) {
      setMessage(kk.gpaImportEmpty)
      return
    }
    onImport(parsed)
    setOpen(false)
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={openModal} className="shrink-0 text-muted-foreground">
        <ClipboardPaste className="size-3.5" />
        {kk.gpaImportBtn}
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={kk.gpaImportBtn} description={kk.gpaImportHint} className="max-w-2xl">
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            rows={9}
            placeholder={kk.gpaImportPlaceholder}
            className="w-full rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs tabular-nums outline-none focus:border-primary/50"
          />
          {message && <p className="text-xs text-destructive">{message}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{kk.gpaImportClose}</Button>
            <Button size="sm" onClick={apply} disabled={!text.trim()}>{kk.gpaImportApply}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
