import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface Props {
  url: string
  title: string
  onClose: () => void
}

export default function PdfViewer({ url, title, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [error, setError] = useState(false)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  useEffect(() => {
    pdfjsLib.getDocument({ url }).promise.then((doc) => {
      setPdf(doc)
      setTotalPages(doc.numPages)
    }).catch(() => setError(true))
  }, [url])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel()
    }

    pdf.getPage(page).then((p) => {
      const containerWidth = canvas.parentElement?.clientWidth ?? window.innerWidth
      const viewport = p.getViewport({ scale: 1 })
      const scale = containerWidth / viewport.width
      const scaled = p.getViewport({ scale })
      canvas.width = scaled.width
      canvas.height = scaled.height
      const task = p.render({ canvasContext: ctx, viewport: scaled, canvas })
      renderTaskRef.current = task
      task.promise.catch(() => null)
    })
  }, [pdf, page])

  function download() {
    const a = document.createElement('a')
    a.href = url
    a.download = title
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      <div className="flex items-center justify-between bg-emerald-800 text-white px-4 py-3 shrink-0">
        <span className="text-sm font-medium truncate flex-1 mr-3">{title}</span>
        <div className="flex items-center gap-3">
          <button onClick={download} aria-label="Download" className="text-white/80 hover:text-white">
            <Download size={18} />
          </button>
          <button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-800 flex flex-col items-center py-4 gap-4">
        {error && (
          <p className="text-white/60 text-sm mt-8">Could not render this document.</p>
        )}
        <canvas ref={canvasRef} className="w-full max-w-full shadow-xl" />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 bg-emerald-800 text-white py-3 shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="disabled:opacity-30"
          >
            <ChevronLeft size={22} />
          </button>
          <span className="text-sm font-medium">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="disabled:opacity-30"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </div>
  )
}
