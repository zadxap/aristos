import { useState, useMemo } from 'react'
import { useAristosDB } from '@/context/DBContext'
import { SubjectCard } from '@/components/subjects/SubjectCard'
import { kk } from '@/i18n'
import { Search, Plus, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { ImportModal } from '@/components/layout/ImportModal'

export function SubjectsPage() {
  const confirm = useConfirm()
  const {
    subjects,
    activeCourse,
    activeSemester,
    calendar,
    availableSemesters,
    setActiveSemester,
    editMode,
    removeSubject,
    updateSubject,
  } = useAristosDB()

  const [searchQuery, setSearchQuery] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const activeSem = calendar?.semesters.find((semester) => semester.semester === activeSemester)
  const isAcademicPeriod = Boolean(activeSem && todayKey >= activeSem.semester_start && todayKey <= activeSem.semester_end)

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => s.course === activeCourse && s.semester === activeSemester).filter((s) => {

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = s.subject_name.toLowerCase().includes(q)
        const matchesTeacher = s.teacher?.name?.toLowerCase().includes(q)
        const matchesCode = s.subject_code?.toLowerCase().includes(q)
        return matchesName || matchesTeacher || matchesCode
      }

      return true
    })
  }, [subjects, activeCourse, activeSemester, searchQuery])

  const semesterCounts = availableSemesters.map((semester) => ({
    semester,
    count: subjects.filter((subject) => subject.course === activeCourse && subject.semester === semester).length,
  }))

  const handleDelete = async (subject_id: string) => {
    const ok = await confirm({ title: kk.delete, description: kk.deleteSubjectConfirm, destructive: true })
    if (ok) {
      await removeSubject(subject_id)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {kk.subjects}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kk.courseNumber(activeCourse)} · {kk.semesterNumber(activeSemester)} · {kk.subjectsCount(filteredSubjects.length)}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
          className="text-xs gap-1.5 h-8"
        >
          <Plus className="size-3.5 text-primary" />
          <span>{kk.addSubject}</span>
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={kk.search}
          className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-border/80 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
        />
      </div>

      {/* Semester Filter Tabs */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-1">
        {semesterCounts.map(({ semester, count }) => (
          <button
            key={semester}
            onClick={() => setActiveSemester(semester)}
            aria-pressed={activeSemester === semester}
            className={`min-w-0 rounded-lg py-2 text-xs font-medium transition-all duration-200 ${activeSemester === semester ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {kk.semesterNumber(semester)} <span className="text-muted-foreground">({count})</span>
          </button>
        ))}
      </div>

      {/* Out-of-semester notice: subjects stay browsable, the schedule just doesn't apply */}
      {!isAcademicPeriod && filteredSubjects.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {kk.outOfSemesterNote}
        </div>
      )}

      {/* Subjects Grid */}
      {filteredSubjects.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border/80 rounded-2xl bg-muted/20">
          <BookOpen className="size-8 mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-sm font-medium text-foreground">{kk.noSubjectsFound}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {!isAcademicPeriod && subjects.some((s) => s.course === activeCourse)
              ? kk.noCalendarForYear
              : kk.searchHint}
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSubjects.map((sub) => (
            <SubjectCard
              key={sub.subject_id}
              subject={sub}
              editMode={editMode}
              onDelete={() => handleDelete(sub.subject_id)}
              onEdit={updateSubject}
            />
          ))}
        </div>
      )}

      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
