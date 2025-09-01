"use client"
import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

export function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className={clsx('fixed inset-0 z-50 flex items-center justify-center')}> 
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-4 shadow-lg">{children}</div>
    </div>, document.body)
}
