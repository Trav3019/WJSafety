import { useEffect, useState } from 'react'
import * as mammoth from 'mammoth'
import { X, Download } from 'lucide-react'

interface Props {
  blob: Blob
  title: string
  onClose: () => void
}

export default function WordViewer({ blob, title, onClose }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    blob.arrayBuffer().then((buf) => {
      mammoth.convertToHtml({ arrayBuffer: buf })
        .then((result) => setHtml(result.value))
        .catch(() => setError(true))
    })
  }, [blob])

  function download() {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = title
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      <div className="flex items-center justify-between bg-emerald-800 text-white px-4 py-3 shrink-0">
        <span className="text-sm font-medium truncate flex-1 mr-3">{title}</span>
        <div className="flex items-center gap-3">
          <button onClick={download} className="text-white/80 hover:text-white" aria-label="Download">
            <Download size={18} />
          </button>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        {error ? (
          <div className="p-6 text-center">
            <p className="text-gray-500 text-sm mb-3">This document format can't be previewed.</p>
            <button
              onClick={download}
              className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Download to open
            </button>
          </div>
        ) : html === null ? (
          <p className="text-gray-400 text-sm p-6 text-center">Loading…</p>
        ) : (
          <div
            className="word-content max-w-2xl mx-auto px-5 py-6"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>

      <style>{`
        .word-content { font-size: 15px; line-height: 1.7; color: #1f2937; }
        .word-content h1 { font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em; color: #065f46; }
        .word-content h2 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.4em; color: #065f46; }
        .word-content h3 { font-size: 1.1em; font-weight: 600; margin: 0.8em 0 0.3em; }
        .word-content p { margin: 0 0 0.75em; }
        .word-content table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 13px; }
        .word-content td, .word-content th { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }
        .word-content th { background: #ecfdf5; font-weight: 600; color: #065f46; }
        .word-content tr:nth-child(even) td { background: #f9fafb; }
        .word-content ul, .word-content ol { padding-left: 1.5em; margin: 0.5em 0 0.75em; }
        .word-content li { margin-bottom: 0.25em; }
        .word-content strong, .word-content b { font-weight: 600; }
        .word-content em, .word-content i { font-style: italic; }
        .word-content img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.5em 0; }
      `}</style>
    </div>
  )
}
