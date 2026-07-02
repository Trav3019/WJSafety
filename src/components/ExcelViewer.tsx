import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react'

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
    const ws = workbook.Sheets[activeSheet]
    const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
    setRows(data)
  }, [workbook, activeSheet])

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

  const headerRow = rows[0] ?? []
  const dataRows = rows.slice(1)

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-emerald-800 text-white px-4 py-3 shrink-0">
        <span className="text-sm font-medium truncate flex-1 mr-2">{title}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}
            className="text-white/80 hover:text-white p-1"
            aria-label="Zoom out"
          >
            <ZoomOut size={17} />
          </button>
          <span className="text-xs text-white/70 w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))}
            className="text-white/80 hover:text-white p-1"
            aria-label="Zoom in"
          >
            <ZoomIn size={17} />
          </button>
          <button onClick={download} className="text-white/80 hover:text-white p-1" aria-label="Download">
            <Download size={17} />
          </button>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1" aria-label="Close">
            <X size={19} />
          </button>
        </div>
      </div>

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex overflow-x-auto bg-emerald-900 shrink-0 border-b border-emerald-700">
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

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        {rows.length === 0 ? (
          <p className="text-gray-400 text-sm p-6 text-center">Loading…</p>
        ) : (
          <div style={{ fontSize: `${zoom * 11}px`, minWidth: 'max-content' }}>
            <table className="border-collapse">
              <thead>
                <tr className="sticky top-0 z-10 bg-emerald-700 text-white">
                  {headerRow.map((cell, ci) => (
                    <th
                      key={ci}
                      className={`border border-emerald-600 px-2 py-1.5 font-semibold text-left whitespace-nowrap ${
                        ci === 0 ? 'sticky left-0 bg-emerald-700 z-20' : ''
                      }`}
                      style={{ maxWidth: `${zoom * 160}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {String(cell ?? '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {headerRow.map((_, ci) => (
                      <td
                        key={ci}
                        className={`border border-gray-200 px-2 py-1 whitespace-nowrap text-gray-800 ${
                          ci === 0
                            ? `sticky left-0 z-10 font-medium ${ri % 2 === 0 ? 'bg-emerald-50' : 'bg-emerald-50'}`
                            : ''
                        }`}
                        style={{ maxWidth: `${zoom * 160}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {String(row[ci] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 bg-gray-100 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between">
        <span className="text-xs text-gray-400">{dataRows.length} rows · {headerRow.length} columns</span>
        <span className="text-xs text-gray-400">Scroll to navigate · Use +/− to zoom</span>
      </div>
    </div>
  )
}
