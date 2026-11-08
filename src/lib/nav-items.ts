import { useLocation } from 'react-router-dom'
import { BookOpen, CalendarDays, GraduationCap, House, ListTodo, Sigma, Sparkles, type LucideIcon } from 'lucide-react'
import { kk } from '@/i18n'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  isActive: boolean
}

export function useNavItems(): NavItem[] {
  const { pathname } = useLocation()
  return [
    { to: '/', label: kk.home, icon: House, isActive: pathname === '/' },
    { to: '/calendar', label: kk.calendar, icon: CalendarDays, isActive: pathname.startsWith('/calendar') },
    { to: '/deadlines', label: kk.deadlines, icon: ListTodo, isActive: pathname.startsWith('/deadlines') },
    { to: '/grades', label: kk.gradesTitle, icon: GraduationCap, isActive: pathname.startsWith('/grades') },
    { to: '/gpa', label: 'GPA', icon: Sigma, isActive: pathname.startsWith('/gpa') },
    { to: '/advisor', label: kk.advisorTitle, icon: Sparkles, isActive: pathname.startsWith('/advisor') },
    { to: '/subjects', label: kk.subjects, icon: BookOpen, isActive: pathname.startsWith('/subjects') },
  ]
}
