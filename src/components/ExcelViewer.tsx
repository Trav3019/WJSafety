import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { X, Download } from 'lucide-react'

interface Props {
  blob: Blob
  title: string
  onClose: () => void
}

export default function ExcelViewer({ blob, title, onClose }: Props) {
  const [sheets, setSheets] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState('')
  const [html, setHtml] = useState('')
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [scale, setScale] = useState(1)
  const [scaledHeight, setScaledHeight] = useState<number | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    blob.arrayBuffer().then((buf) => {
      const wb = XLSX.read(buf, { type: 'array' })
      setWorkbook(wb)
      setSheets(wb.SheetNames)
      setActiveSheet(wb.SheetNames[0])
    })
  }, [blob])

  useEffect(() => {
    if (!workbook || !activeSheet) return
    const sheetHtml = XLSX.utils.sheet_to_html(workbook.Sheets[activeSheet])
    setScale(1)
    setScaledHeight(null)
    setHtml(sheetHtml)
  }, [workbook, activeSheet])

  // After html renders, measure and compute scale
  useEffect(() => {
    if (!html || !innerRef.current || !scrollRef.current) return
    // Wait one frame for the DOM to paint
    requestAnimationFrame(() => {
      if (!innerRef.current || !scrollRef.current) return
      const contentW = innerRef.current.scrollWidth
      const containerW = scrollRef.current.clientWidth
      if (contentW > containerW && contentW > 0) {
        const s = containerW / contentW
        setScale(s)
        // collapsed height = full rendered height * scale
        setScaledHeight(innerRef.current.scrollHeight * s)
      }
    })
  }, [html])

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

      {sheets.length > 1 && (
        <div className="flex overflow-x-auto bg-emerald-900 shrink-0">
          {sheets.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSheet(s)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                s === activeSheet ? 'bg-white text-emerald-800' : 'text-emerald-200 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Outer scroll container — vertical only */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
        {!html ? (
          <p className="text-gray-400 text-sm p-6 text-center">Loading…</p>
        ) : (
          /* Clipping wrapper — collapses to the visually-scaled height */
          <div
            style={{
              width: '100%',
              height: scaledHeight !== null ? scaledHeight : undefined,
              overflow: 'hidden',
            }}
          >
            {/* Inner div that's actually transformed */}
            <div
              ref={innerRef}
              style={{
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>

      <style>{`
        /* Reset SheetJS default table styles */
        .flex-1 table { border-collapse: collapse; font-size: 13px; line-height: 1.4; }
        .flex-1 td, .flex-1 th { border: 1px solid #d1d5db; padding: 4px 8px; white-space: nowrap; color: #1f2937; }
        .flex-1 tr:first-child td, .flex-1 tr:first-child th {
          background: #ecfdf5; color: #065f46; font-weight: 600;
        }
        .flex-1 tr:nth-child(even) td { background: #f9fafb; }
      `}</style>
    </div>
  )
}
