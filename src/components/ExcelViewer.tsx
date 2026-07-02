import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { X, Download, Pencil, Check, Plus, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Props {
  blob: Blob
  title: string
  storagePath: string
  onClose: () => void
}

const MIN_SCALE = 0.2
const MAX_SCALE = 3

export default function ExcelViewer({ blob, title, storagePath, onClose }: Props) {
  const [sheets, setSheets] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [scale, setScale] = useState(1)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null)
  const scaleRef = useRef(1)

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
    setDirty(false)
  }, [workbook, activeSheet])

  // Non-passive pinch-to-zoom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function dist(touches: TouchList) {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.hypot(dx, dy)
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2)
        pinchRef.current = { startDist: dist(e.touches), startScale: scaleRef.current }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
          pinchRef.current.startScale * (dist(e.touches) / pinchRef.current.startDist)))
        scaleRef.current = s
        setScale(s)
      }
    }

    function onTouchEnd() { pinchRef.current = null }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  function updateCell(ri: number, ci: number, value: string) {
    setRows((prev) => {
      const next = prev.map((r) => [...r])
      while (next[ri].length <= ci) next[ri].push('')
      next[ri][ci] = value
      return next
    })
    setDirty(true)
  }

  function addRow() {
    const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0)
    setRows((prev) => [...prev, Array(colCount).fill('')])
    setDirty(true)
  }

  async function save() {
    if (!workbook || !activeSheet) return
    setSaving(true)
    try {
      // Write updated rows back into the workbook
      const ws = XLSX.utils.aoa_to_sheet(rows)
      workbook.Sheets[activeSheet] = ws
      const buf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      const fileBlob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const { error } = await supabase.storage
        .from('documents')
        .upload(storagePath, fileBlob, { upsert: true })
      if (error) {
        alert('Save failed: ' + error.message)
      } else {
        setDirty(false)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

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
      {/* Header */}
      <div className="flex items-center justify-between bg-emerald-800 text-white px-4 py-3 shrink-0">
        <span className="text-sm font-medium truncate flex-1 mr-3">{title}</span>
        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="flex items-center gap-1.5 bg-white text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
              >
                {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
                Save
              </button>
              <button
                onClick={() => {
                  if (dirty && !confirm('Discard unsaved changes?')) return
                  // reload from workbook
                  if (workbook && activeSheet) {
                    const data = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[activeSheet], { header: 1, defval: '' })
                    setRows(data as string[][])
                  }
                  setDirty(false)
                  setEditing(false)
                }}
                className="text-white/70 hover:text-white text-xs"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-white/80 hover:text-white"
              aria-label="Edit"
            >
              <Pencil size={16} />
            </button>
          )}
          <button onClick={download} className="text-white/80 hover:text-white" aria-label="Download">
            <Download size={18} />
          </button>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
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
                s === activeSheet ? 'bg-white text-emerald-800' : 'text-emerald-200 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable content */}
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
                        padding: 0,
                        background: '#ecfdf5',
                        color: '#065f46',
                        fontWeight: 600,
                        textAlign: 'left',
                        minWidth: 80,
                      }}
                    >
                      {editing ? (
                        <input
                          value={rows[0]?.[ci] ?? ''}
                          onChange={(e) => updateCell(0, ci, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '5px 10px',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#065f46',
                            fontWeight: 600,
                            fontSize: 'inherit',
                            fontFamily: 'inherit',
                          }}
                        />
                      ) : (
                        <span style={{ display: 'block', padding: '5px 10px' }}>{rows[0]?.[ci] ?? ''}</span>
                      )}
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
                          padding: 0,
                          color: '#1f2937',
                          minWidth: 80,
                        }}
                      >
                        {editing ? (
                          <input
                            value={row[ci] ?? ''}
                            onChange={(e) => updateCell(ri + 1, ci, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 10px',
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#1f2937',
                              fontSize: 'inherit',
                              fontFamily: 'inherit',
                            }}
                          />
                        ) : (
                          <span style={{ display: 'block', padding: '4px 10px' }}>{row[ci] ?? ''}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {editing && (
              <button
                onClick={addRow}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  margin: '8px 0 4px',
                  padding: '6px 12px',
                  fontSize: 12,
                  color: '#065f46',
                  background: '#ecfdf5',
                  border: '1px dashed #6ee7b7',
                  borderRadius: 8,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={13} />
                Add row
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {rows.length > 0 ? rows.length - 1 : 0} rows · {colCount} cols
          {dirty && <span className="text-amber-500 ml-2">● unsaved</span>}
        </span>
        <span className="text-xs text-gray-400">{Math.round(scale * 100)}%</span>
      </div>
    </div>
  )
}
