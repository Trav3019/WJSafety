import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type FieldType = 'signature' | 'initials' | 'date'

export interface PlacedField {
  id: string
  page: number
  x: number      // 0–1
  y: number      // 0–1
  width: number  // 0–1
  height: number // 0–1
  type: FieldType
  label: string
}

const FIELD_COLORS: Record<FieldType, string> = {
  signature: 'rgba(16,185,129,0.25)',
  initials:  'rgba(59,130,246,0.25)',
  date:      'rgba(245,158,11,0.25)',
}
const FIELD_BORDER: Record<FieldType, string> = {
  signature: '#10b981',
  initials:  '#3b82f6',
  date:      '#f59e0b',
}
const FIELD_LABELS: Record<FieldType, string> = {
  signature: 'Signature',
  initials:  'Initials',
  date:      'Date',
}

// Default sizes relative to page
const FIELD_SIZES: Record<FieldType, { w: number; h: number }> = {
  signature: { w: 0.28, h: 0.06 },
  initials:  { w: 0.14, h: 0.05 },
  date:      { w: 0.18, h: 0.04 },
}

interface Props {
  pdfUrl: string
  fields: PlacedField[]
  onChange: (fields: PlacedField[]) => void
}

export default function PdfFieldEditor({ pdfUrl, fields, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [activeTool, setActiveTool] = useState<FieldType>('signature')
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    pdfjsLib.getDocument({ url: pdfUrl }).promise.then((doc) => {
      setPdf(doc)
      setTotalPages(doc.numPages)
    })
  }, [pdfUrl])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    if (renderTaskRef.current) renderTaskRef.current.cancel()

    pdf.getPage(page).then((p) => {
      const containerWidth = canvas.parentElement?.clientWidth ?? 600
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

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const xRel = (e.clientX - rect.left) / rect.width
    const yRel = (e.clientY - rect.top) / rect.height
    const { w, h } = FIELD_SIZES[activeTool]
    const newField: PlacedField = {
      id: crypto.randomUUID(),
      page,
      x: Math.min(xRel - w / 2, 1 - w),
      y: Math.min(yRel - h / 2, 1 - h),
      width: w,
      height: h,
      type: activeTool,
      label: FIELD_LABELS[activeTool],
    }
    onChange([...fields, newField])
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id))
  }

  const pageFields = fields.filter((f) => f.page === page)

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium mr-1">Place:</span>
        {(['signature', 'initials', 'date'] as FieldType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTool(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={{
              background: activeTool === t ? FIELD_COLORS[t] : 'white',
              borderColor: activeTool === t ? FIELD_BORDER[t] : '#e5e7eb',
              color: activeTool === t ? FIELD_BORDER[t] : '#6b7280',
            }}
          >
            {FIELD_LABELS[t]}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">Tap the PDF to place a field</span>
      </div>

      {/* PDF + overlay */}
      <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-100 select-none">
        <canvas ref={canvasRef} className="w-full block" />

        {/* Clickable overlay */}
        <div
          ref={overlayRef}
          className="absolute inset-0 cursor-crosshair"
          onClick={handleOverlayClick}
          style={{ width: canvasSize.w || '100%', height: canvasSize.h || '100%' }}
        >
          {pageFields.map((f) => (
            <div
              key={f.id}
              className="absolute flex items-center justify-between px-1.5 rounded"
              style={{
                left: `${f.x * 100}%`,
                top: `${f.y * 100}%`,
                width: `${f.width * 100}%`,
                height: `${f.height * 100}%`,
                background: FIELD_COLORS[f.type],
                border: `1.5px solid ${FIELD_BORDER[f.type]}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className="text-xs font-semibold truncate leading-none"
                style={{ color: FIELD_BORDER[f.type], fontSize: '10px' }}
              >
                {f.label}
              </span>
              <button
                type="button"
                onClick={() => removeField(f.id)}
                className="shrink-0 ml-1"
                style={{ color: FIELD_BORDER[f.type] }}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Page controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="disabled:opacity-30 text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="disabled:opacity-30 text-gray-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Field summary */}
      {fields.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Placed fields</p>
          <div className="space-y-1">
            {fields.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: FIELD_BORDER[f.type] }}>
                  {f.label}
                </span>
                <span className="text-gray-400">Page {f.page}</span>
                <button
                  type="button"
                  onClick={() => removeField(f.id)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
