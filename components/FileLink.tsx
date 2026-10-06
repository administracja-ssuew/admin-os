'use client'

import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { FILES_BUCKET, storagePath } from '../lib/files'

/** Magazyn plików jest prywatny: otwieramy plik krótkotrwałym linkiem podpisanym (5 min). */
export async function openStoredFile(ref: string) {
  const path = storagePath(ref)
  if (!path) {
    window.open(ref, '_blank', 'noopener,noreferrer')
    return
  }
  // Okno otwieramy od razu (w obsłudze kliknięcia), żeby nie zablokowała go przeglądarka
  const win = window.open('', '_blank')
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, 300)
  if (error || !data) {
    win?.close()
    toast.error('Nie udało się otworzyć pliku')
    return
  }
  if (win) {
    win.opener = null
    win.location.href = data.signedUrl
  } else {
    window.location.href = data.signedUrl
  }
}

export default function FileLink({ href, className, title, children }: {
  href: string
  className?: string
  title?: string
  children: ReactNode
}) {
  return (
    <a href={href} title={title} className={className} onClick={e => { e.preventDefault(); void openStoredFile(href) }}>
      {children}
    </a>
  )
}
