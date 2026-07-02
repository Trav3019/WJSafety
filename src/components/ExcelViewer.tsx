import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { X, Download } from 'lucide-react'

interface Props {
  blob: Blob
  title: string
  onClose: () => void
}

const MIN_SCALE = 0.2
const MAX_SCALE = 3

export default function ExcelViewer({ blob, title, onClose }: Props) {
  const [sheets, setSheets] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [scale, setScale] = useState(1)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null)
  const scaleRef = useRef(1)

  // Keep ref in sync so touch handlers (closures) always see latest scale
  useEffect(() => { scaleRef.current = scale }, [scale])

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
    const data = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[activeSheet], {
      header: 1,
      defval: '',
    })
    setRows(data as string[][])
  }, [workbook, activeSheet])

  // Attach non-passive touch listeners so we can preventDefault on pinch
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function dist(touches: TouchList) {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.hypot(dx, dy)
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        pinchRef.current = { startDist: dist(e.touches), startScale: scaleRef.current }
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault() // stop browser zoom / scroll during pinch
        const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, pinchRef.current.startScale * (dist(e.touches) / pinchRef.current.startDist))
        )
        scaleRef.current = newScale
        setScale(newScale)
      }
    }

    function onTouchEnd() {
      pinchRef.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

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

  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0)

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

      <div ref={scrollRef} className="flex-1 overflow-auto bg-white">
        {rows.length === 0 ? (
          <p className="text-gray-400 text-sm p-6 text-center">Loading…</p>
        ) : (
          <div style={{ display: 'inline-block', transformOrigin: 'top left', transform: `scale(${scale})` }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  {Array.from({ length: colCount }).map((_, ci) => (
                    <th
                      key={ci}
                      style={{
                        border: '1px solid #d1d5db',
                        padding: '5px 10px',
                        background: '#ecfdf5',
                        color: '#065f46',
                        fontWeight: 600,
                        textAlign: 'left',
                      }}
                    >
                      {rows[0]?.[ci] ?? ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    {Array.from({ length: colCount }).map((_, ci) => (
                      <td
                        key={ci}
                        style={{
                          border: '1px solid #e5e7eb',
                          padding: '4px 10px',
                          color: '#1f2937',
                        }}
                      >
                        {row[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="shrink-0 bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {rows.length > 0 ? rows.length - 1 : 0} rows · {colCount} cols
        </span>
        <span className="text-xs text-gray-400">{Math.round(scale * 100)}%</span>
      </div>
    </div>
  )
}
