import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DBProvider } from '@/context/DBContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { CalendarPage } from '@/pages/CalendarPage'
import { DeadlinesPage } from '@/pages/DeadlinesPage'
import { GradesPage } from '@/pages/GradesPage'
import GpaPage from '@/pages/GpaPage'
import { SubjectsPage } from '@/pages/SubjectsPage'
import { AdvisorPage } from '@/pages/AdvisorPage'
import { SubjectDetailPage } from '@/pages/SubjectDetailPage'
import { PdfViewerPage } from '@/pages/PdfViewerPage'
import { isTauri } from '@/lib/tauri'

export function App() {
  // В Tauri адрес корня — http://tauri.localhost (или tauri://localhost),
  // path-роутинг там ненадёжен — используем HashRouter; на вебе URL чистые.
  const Router = isTauri() ? HashRouter : BrowserRouter
  return (
    <DBProvider>
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/deadlines" element={<DeadlinesPage />} />
            <Route path="/grades" element={<GradesPage />} />
            <Route path="/gpa" element={<GpaPage />} />
            <Route path="/advisor" element={<AdvisorPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/subjects/:id" element={<SubjectDetailPage />} />
            <Route path="/pdf/:id" element={<PdfViewerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </Router>
    </DBProvider>
  )
}

export default App
