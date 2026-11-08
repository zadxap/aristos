import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useAristosDB } from "@/context/DBContext"
import { TopicTable } from "@/components/subjects/TopicTable"
import { PdfDocuments } from "@/components/subjects/PdfDocuments"
import { UploadedPdfs } from "@/components/subjects/UploadedPdfs"
import { CanvasGradesCard } from "@/components/subjects/CanvasGradesCard"
import { getSubjectPdfs } from "@/lib/pdf-map"
import { getAcademicWeek } from "@/lib/academic-week"
import { kk } from "@/i18n"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, User, Phone, Mail, BookOpen, FileText } from "lucide-react"

export function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { subjects, calendar, activeSemester, editMode, updateSubject } =
    useAristosDB()

  const subject = subjects.find((s) => s.subject_id === id)
  const [activeTab, setActiveTab] = useState<"topics" | "materials">("topics")

  const pdfDocuments = subject ? getSubjectPdfs(subject) : []

  const activeSem = calendar?.semesters?.find(
    (s) => s.semester === activeSemester
  )
  const currentWeek = activeSem
    ? getAcademicWeek(
        new Date(),
        activeSem.semester_start,
        activeSem.total_weeks
      )
    : 1

  if (!subject) {
    return (
      <div className="space-y-3 py-20 text-center">
        <p className="text-base font-medium">{kk.noSubjectsFound}</p>
        <Link
          to="/subjects"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          <span>{kk.back}</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate("/subjects")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>{kk.backToSubjects}</span>
        </button>
      </div>

      {/* Subject Header Card */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="blue" className="font-mono text-xs font-medium">
              {subject.subject_code}
            </Badge>
            <Badge variant="secondary" className="text-xs font-medium">
              {subject.credits_ects} ECTS
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              {kk.courseAndSemester(subject.course, subject.semester)}
            </span>
          </div>

          <h1 className="text-lg leading-snug font-bold tracking-tight text-foreground sm:text-xl">
            {subject.subject_name}
          </h1>

          {/* Teacher details */}
          {subject.teacher && (
            <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <User className="size-3.5 text-primary" />
                <span>{subject.teacher.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-muted-foreground">
                {subject.teacher.phone && (
                  <a
                    href={`tel:${subject.teacher.phone}`}
                    className="flex items-center gap-1 transition-colors hover:text-primary"
                  >
                    <Phone className="size-3 text-primary" />
                    <span>{subject.teacher.phone}</span>
                  </a>
                )}
                {subject.teacher.email && (
                  <a
                    href={`mailto:${subject.teacher.email}`}
                    className="flex items-center gap-1 transition-colors hover:text-primary"
                  >
                    <Mail className="size-3 text-primary" />
                    <span className="break-all">{subject.teacher.email}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {subject.description && (
            <div className="pt-2 text-xs leading-relaxed text-muted-foreground">
              <span className="mb-1 block font-semibold text-foreground/80">
                {kk.description}:
              </span>
              <p>{subject.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canvas grades (only when the subject is linked to a Canvas course) */}
      <CanvasGradesCard subject={subject} />

      {/* Main Tabs: Topics vs PDF Materials */}
      <div className="grid min-w-0 grid-cols-2 gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-1">
        <button
          onClick={() => setActiveTab("topics")}
          className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-center text-xs font-medium transition-all sm:gap-2 sm:px-2 ${
            activeTab === "topics"
              ? "bg-card font-semibold text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="size-3.5" />
          <span className="min-w-0 break-words">
            {kk.topics} ({subject.topics?.length || 0})
          </span>
        </button>

        <button
          onClick={() => setActiveTab("materials")}
          className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-center text-xs font-medium transition-all sm:gap-2 sm:px-2 ${
            activeTab === "materials"
              ? "bg-card font-semibold text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-3.5 text-primary" />
          <span className="min-w-0 break-words">
            {kk.materials} ({pdfDocuments.length})
          </span>
        </button>
      </div>

      {/* Active Tab Content */}
      {activeTab === "topics" ? (
        <TopicTable
          topics={subject.topics || []}
          currentWeek={currentWeek}
          editMode={editMode}
          onSave={(topics) => void updateSubject({ ...subject, topics })}
        />
      ) : (
        <div className="space-y-5">
          {/* Загруженные юзером PDF (IndexedDB, оффлайн) */}
          <UploadedPdfs subjectId={subject.subject_id} editMode={editMode} />

          {/* Ссылки из subject.pdfs (задаются в curriculum-builder) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {kk.pdfLinkSection}
            </h3>
            <PdfDocuments documents={pdfDocuments} />
          </div>
        </div>
      )}
    </div>
  )
}
