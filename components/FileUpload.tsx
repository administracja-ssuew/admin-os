'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileIcon, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

/** Zamienia polskie znaki i spacje na bezpieczne odpowiedniki */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/ą/g, 'a').replace(/Ą/g, 'A')
    .replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/ę/g, 'e').replace(/Ę/g, 'E')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/ń/g, 'n').replace(/Ń/g, 'N')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ś/g, 's').replace(/Ś/g, 'S')
    .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
    .replace(/ż/g, 'z').replace(/Ż/g, 'Z')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

export interface UploadedFile {
  id: string
  name: string
  url: string
  added_at: string
}

interface FileUploadProps {
  bucketPath: string
  onUploadComplete: (file: UploadedFile) => void
  accept?: string
  maxSizeMB?: number
  maxFiles?: number
  label?: string
}

export default function FileUpload({
  bucketPath,
  onUploadComplete,
  accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx',
  maxSizeMB = 10,
  maxFiles = 1,
  label = 'Dodaj plik',
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files).slice(0, maxFiles)

    for (const file of fileArray) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`Plik "${file.name}" przekracza limit ${maxSizeMB}MB`)
        continue
      }

      setUploading(true)
      const toastId = toast.loading(`Wysyłanie: ${file.name}...`)

      try {
        const safeName = sanitizeFileName(file.name)
        const filePath = `${bucketPath}/${crypto.randomUUID()}/${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('adminos-files')
          .upload(filePath, file, { contentType: file.type })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('adminos-files').getPublicUrl(filePath)

        const uploaded: UploadedFile = {
          id: crypto.randomUUID(),
          name: file.name,
          url: data.publicUrl,
          added_at: new Date().toISOString(),
        }

        onUploadComplete(uploaded)
        toast.success(`Przesłano: ${file.name}`, { id: toastId })
      } catch (err: any) {
        toast.error(`Błąd przesyłania: ${err.message}`, { id: toastId })
      } finally {
        setUploading(false)
      }
    }

    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
      className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
        dragOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500'
      }`}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {uploading ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 size={20} className="animate-spin text-blue-500" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Przesyłanie...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 py-2">
          <Upload size={20} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
          <span className="text-xs text-slate-400">Przeciągnij lub kliknij (max {maxSizeMB}MB)</span>
        </div>
      )}
    </div>
  )
}
