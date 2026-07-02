import { useEffect, useState } from 'react'
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
    const table = XLSX.utils.sheet_to_html(ws, { header: '', footer: '' })
    setHtml(table)
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

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
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

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex overflow-x-auto bg-emerald-900 shrink-0">
          {sheets.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSheet(s)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                s === activeSheet
                  ? 'bg-white text-emerald-800'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto bg-white">
        {html ? (
          <div
            className="excel-table p-2"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-gray-400 text-sm p-6">Loading…</p>
        )}
      </div>

      <style>{`
        .excel-table table {
          border-collapse: collapse;
          font-size: 12px;
          min-width: 100%;
        }
        .excel-table td, .excel-table th {
          border: 1px solid #e5e7eb;
          padding: 4px 8px;
          white-space: nowrap;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .excel-table tr:nth-child(even) td {
          background: #f9fafb;
        }
        .excel-table tr:first-child td {
          background: #ecfdf5;
          font-weight: 600;
          color: #065f46;
        }
      `}</style>
    </div>
  )
}
