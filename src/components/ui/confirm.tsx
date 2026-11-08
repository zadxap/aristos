import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from './modal'
import { Button } from './button'
import { kk } from '@/i18n'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** красная кнопка действия (удаление, перезапись) */
  destructive?: boolean
  /** только кнопка «ОК» — стилизованная замена alert() */
  info?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Стилизованные подтверждения вместо window.confirm/alert:
 *  const confirm = useConfirm(); if (await confirm({ title, description, destructive: true })) … */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={pending !== null}
        onClose={() => close(false)}
        title={pending?.title ?? ''}
        className="max-w-md"
      >
        {pending?.description && <p className="text-sm leading-relaxed text-muted-foreground">{pending.description}</p>}
        <div className="mt-4 flex justify-end gap-2">
          {!pending?.info && (
            <Button variant="ghost" size="sm" onClick={() => close(false)}>
              {pending?.cancelLabel ?? kk.cancel}
            </Button>
          )}
          <Button
            size="sm"
            variant={pending?.destructive ? 'destructive' : 'default'}
            onClick={() => close(true)}
          >
            {pending?.confirmLabel ?? (pending?.destructive ? kk.confirmDelete : kk.confirmOk)}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm требует ConfirmProvider (AppLayout)')
  return ctx
}
