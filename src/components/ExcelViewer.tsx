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
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)

  useEffect(() => {
    blob.arrayBuffer().then((buf) => {
      const wb = XLSX.read(buf, { type: 'array', cellStyles: true })
      setWorkbook(wb)
      setSheets(wb.SheetNames)
      setActiveSheet(wb.SheetNames[0])
    })
  }, [blob])

  useEffect(() => {
    if (!workbook || !activeSheet) return

    // Let SheetJS generate a full HTML document for this sheet
    const htmlStr = XLSX.utils.sheet_to_html(workbook.Sheets[activeSheet])

    // Wrap with styles + a script that auto-scales the table to fit screen width
    const full = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta id="vp" name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 6px; font-family: -apple-system, sans-serif; font-size: 13px; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #d1d5db; padding: 4px 8px; white-space: nowrap; vertical-align: top; }
  tr:first-child td, tr:first-child th { background: #ecfdf5; font-weight: 600; color: #065f46; position: sticky; top: 0; z-index: 1; }
  tr:nth-child(even) td { background: #f9fafb; }
</style>
</head>
<body>${htmlStr}
<script>
  window.addEventListener('load', function() {
    var table = document.querySelector('table');
    if (!table) return;
    var tw = table.scrollWidth + 12;
    var sw = window.screen.width;
    if (tw > sw) {
      var scale = (sw / tw).toFixed(4);
      document.getElementById('vp').content =
        'width=' + tw + ', initial-scale=' + scale + ', maximum-scale=5';
    }
  });
<\/script>
</body>
</html>`

    const htmlBlob = new Blob([full], { type: 'text/html' })
    const url = URL.createObjectURL(htmlBlob)
    setIframeSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return url })
  }, [workbook, activeSheet])

  // Clean up on unmount
  useEffect(() => () => { if (iframeSrc) URL.revokeObjectURL(iframeSrc) }, [])

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

      <div className="flex-1 overflow-hidden">
        {iframeSrc ? (
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            className="w-full h-full border-0 bg-white"
            title={activeSheet}
          />
        ) : (
          <p className="text-gray-400 text-sm p-6 text-center bg-white h-full">Loading…</p>
        )}
      </div>
    </div>
  )
}
