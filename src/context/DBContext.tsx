/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react'
import { useDB } from '@/hooks/useDB'

type DBContextType = ReturnType<typeof useDB>

const DBContext = createContext<DBContextType | null>(null)

export function DBProvider({ children }: { children: React.ReactNode }) {
  const db = useDB()
  return <DBContext.Provider value={db}>{children}</DBContext.Provider>
}

export function useAristosDB() {
  const context = useContext(DBContext)
  if (!context) {
    throw new Error('useAristosDB must be used within a DBProvider')
  }
  return context
}
