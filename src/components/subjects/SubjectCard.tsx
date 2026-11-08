import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Subject } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { kk } from '@/i18n'
import { getSubjectPdfs } from '@/lib/pdf-map'
import { User, FileText, ChevronRight, Trash2, Pencil } from 'lucide-react'

interface SubjectCardProps {
  subject: Subject
  editMode?: boolean
  onDelete?: () => void
  onEdit?: (subject: Subject) => void
}

export function SubjectCard({
  subject,
  editMode = false,
  onDelete,
  onEdit,
}: SubjectCardProps) {
  const pdfs = getSubjectPdfs(subject)
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState(subject)

  const saveDraft = () => {
    onEdit?.(draft)
    setEditOpen(false)
  }

  return (
    <Card className="hover:border-primary/50 transition-all hover:shadow-xs group">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="blue" className="text-[10px] py-0 px-2 font-mono">
              {subject.subject_code}
            </Badge>
            <Badge variant="secondary" className="text-[10px] py-0 px-2">
              {subject.credits_ects} ECTS
            </Badge>
            <span className="text-[10px] text-muted-foreground font-medium">
              {kk.semShortN(subject.semester)}
            </span>
          </div>

          {editMode && (
            <div className="flex items-center gap-1">
              {onEdit && <button onClick={() => { setDraft(subject); setEditOpen(true) }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary" aria-label={kk.editSubjectAria} title={kk.edit}><Pencil className="size-3.5" /></button>}
              {onDelete && <button onClick={onDelete} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={kk.deleteSubjectAria} title={kk.delete}><Trash2 className="size-3.5" /></button>}
            </div>
          )}
        </div>

        <Link
          to={`/subjects/${subject.subject_id}`}
          className="block group-hover:text-primary transition-colors"
        >
          <h3 className="font-bold text-base text-foreground leading-snug">
            {subject.subject_name}
          </h3>
        </Link>

        {subject.teacher?.name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3.5 text-primary shrink-0" />
            <span className="truncate">{subject.teacher.name}</span>
          </div>
        )}

        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>{kk.topicsCount(subject.topics?.length || 0)}</span>
            {pdfs.length > 0 && (
              <span className="flex items-center gap-1 text-primary font-medium">
                <FileText className="size-3" />
                {pdfs.length} PDF
              </span>
            )}
          </div>

          <Link
            to={`/subjects/${subject.subject_id}`}
            className="flex items-center gap-0.5 text-primary font-medium text-xs hover:underline"
          >
            <span>{kk.moreDetails}</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </CardContent>
      {onEdit && <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={kk.editSubject} description={subject.subject_name}>
        <form className="max-h-[65vh] space-y-3 overflow-y-auto pr-1" onSubmit={(event) => { event.preventDefault(); saveDraft() }}>
          <label className="block space-y-1 text-xs font-medium">{kk.subjectName}<input required value={draft.subject_name} onChange={(event) => setDraft({ ...draft, subject_name: event.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs font-medium">{kk.codeShort}<input value={draft.subject_code} onChange={(event) => setDraft({ ...draft, subject_code: event.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
            <label className="block space-y-1 text-xs font-medium">ECTS<input type="number" min="0" step="0.5" value={draft.credits_ects} onChange={(event) => setDraft({ ...draft, credits_ects: Number(event.target.value) })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs font-medium">{kk.course}<input type="number" min="1" step="1" required value={draft.course} onChange={(event) => setDraft({ ...draft, course: Number(event.target.value) })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
            <label className="block space-y-1 text-xs font-medium">{kk.semester}<input type="number" min="1" step="1" required value={draft.semester} onChange={(event) => setDraft({ ...draft, semester: Number(event.target.value) })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          </div>
          <label className="block space-y-1 text-xs font-medium">{kk.teacher}<input value={draft.teacher?.name || ''} onChange={(event) => setDraft({ ...draft, teacher: { ...draft.teacher, name: event.target.value } })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="block space-y-1 text-xs font-medium">{kk.phone}<input value={draft.teacher?.phone || ''} onChange={(event) => setDraft({ ...draft, teacher: { ...draft.teacher, phone: event.target.value } })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="block space-y-1 text-xs font-medium">Email<input type="email" value={draft.teacher?.email || ''} onChange={(event) => setDraft({ ...draft, teacher: { ...draft.teacher, email: event.target.value } })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="block space-y-1 text-xs font-medium">{kk.descriptionShort}<textarea rows={3} value={draft.description || ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{kk.cancel}</Button><Button type="submit">{kk.save}</Button></div>
        </form>
      </Modal>}
    </Card>
  )
}
