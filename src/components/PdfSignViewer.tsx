import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const FIELD_COLORS: Record<string, string> = {
  signature: 'rgba(16,185,129,0.3)',
  initials:  'rgba(59,130,246,0.3)',
  date:      'rgba(245,158,11,0.3)',
  text:      'rgba(139,92,246,0.3)',
}
const FIELD_BORDER: Record<string, string> = {
  signature: '#10b981',
  initials:  '#3b82f6',
  date:      '#f59e0b',
  text:      '#8b5cf6',
}

export interface SignField {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
  type: string
  label: string
}

interface Props {
  blobUrl: string
  fields: SignField[]
  values: Record<string, string>
  onFieldTap: (field: SignField) => void
}

export default function PdfSignViewer({ blobUrl, fields, values, onFieldTap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [renderError, setRenderError] = useState(false)

  useEffect(() => {
    pdfjsLib.getDocument({ url: blobUrl }).promise
      .then((doc) => { setPdf(doc); setTotalPages(doc.numPages) })
      .catch(() => setRenderError(true))
  }, [blobUrl])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    if (renderTaskRef.current) renderTaskRef.current.cancel()

    pdf.getPage(page).then((p) => {
      const containerWidth = canvas.parentElement?.clientWidth ?? window.innerWidth
      const vp = p.getViewport({ scale: 1 })
      const scale = containerWidth / vp.width
      const scaled = p.getViewport({ scale })
      canvas.width = scaled.width
      canvas.height = scaled.height
      setCanvasSize({ w: scaled.width, h: scaled.height })
      const task = p.render({ canvasContext: ctx, viewport: scaled, canvas })
      renderTaskRef.current = task
      task.promise.catch(() => null)
    })
  }, [pdf, page])

  if (renderError) return null

  const pageFields = fields.filter((f) => f.page === page)

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm mb-4">
      <div className="relative bg-gray-100 select-none">
        <canvas ref={canvasRef} className="w-full block" />

        {/* Field overlays */}
        <div
          className="absolute inset-0"
          style={{ width: canvasSize.w || '100%', height: canvasSize.h || '100%' }}
        >
          {pageFields.map((f) => {
            const filled = !!values[f.id]
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFieldTap(f)}
                className="absolute flex items-center justify-center rounded transition-opacity"
                style={{
                  left: `${f.x * 100}%`,
                  top: `${f.y * 100}%`,
                  width: `${f.width * 100}%`,
                  height: `${f.height * 100}%`,
                  background: filled ? 'rgba(16,185,129,0.15)' : FIELD_COLORS[f.type] ?? 'rgba(99,102,241,0.25)',
                  border: `2px solid ${filled ? '#10b981' : (FIELD_BORDER[f.type] ?? '#6366f1')}`,
                }}
              >
                {filled ? (
                  f.type === 'signature' || f.type === 'initials' ? (
                    <img src={values[f.id]} alt="" className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <span className="text-emerald-700 text-xs font-medium px-1 truncate">{values[f.id]}</span>
                  )
                ) : (
                  <span className="text-xs font-semibold opacity-80 truncate px-1"
                    style={{ color: FIELD_BORDER[f.type] ?? '#6366f1', fontSize: '10px' }}>
                    {f.label}
                  </span>
                )}
                {filled && (
                  <CheckCircle2 size={10} className="absolute top-0.5 right-0.5 text-emerald-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 bg-gray-50 border-t border-gray-200 py-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="disabled:opacity-30 text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-gray-600 font-medium">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="disabled:opacity-30 text-gray-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
