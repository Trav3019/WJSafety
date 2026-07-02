import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const [rows, setRows] = useState<string[][]>([])
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [zoom, setZoom] = useState(1)

  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)

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
    setZoom(1) // reset before measuring new sheet
    setRows(data as string[][])
  }, [workbook, activeSheet])

  // After rows render at zoom=1, measure and set zoom to fit width
  useLayoutEffect(() => {
    if (!tableRef.current || !containerRef.current || rows.length === 0) return
    const tableW = tableRef.current.scrollWidth
    const containerW = containerRef.current.clientWidth
    if (tableW > containerW) {
      setZoom(containerW / tableW)
    }
  }, [rows])

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

      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
        {rows.length === 0 ? (
          <p className="text-gray-400 text-sm p-6 text-center">Loading…</p>
        ) : (
          <table
            ref={tableRef}
            style={{
              borderCollapse: 'collapse',
              fontSize: 13,
              lineHeight: 1.4,
              zoom,
            }}
          >
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
                      whiteSpace: 'nowrap',
                      textAlign: 'left',
                      position: 'sticky',
                      top: 0,
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
                        whiteSpace: 'nowrap',
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
        )}
      </div>

      <div className="shrink-0 bg-gray-50 border-t border-gray-200 px-4 py-1.5">
        <span className="text-xs text-gray-400">
          {rows.length > 0 ? rows.length - 1 : 0} rows · {colCount} cols · {Math.round(zoom * 100)}% zoom
        </span>
      </div>
    </div>
  )
}
