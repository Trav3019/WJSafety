import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb } from 'pdf-lib'
import { ChevronLeft, ChevronRight, Send, RotateCcw, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SignatureCanvas, { type SignatureCanvasHandle } from '../components/SignatureCanvas'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface SignField {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
  type: 'signature' | 'initials' | 'date'
  label: string
  sort_order: number
}

interface Assignment {
  id: string
  request_id: string
  status: string
  sign_requests: { title: string; pdf_path: string }
}

const FIELD_COLORS = {
  signature: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#065f46' },
  initials:  { bg: 'rgba(59,130,246,0.15)',  border: '#3b82f6', text: '#1e40af' },
  date:      { bg: 'rgba(245,158,11,0.15)',  border: '#f59e0b', text: '#92400e' },
}

function dataURLtoUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return arr
}

export default function SignDoc() {
  const { assignmentId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sigRef = useRef<SignatureCanvasHandle>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [fields, setFields] = useState<SignField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Active field for signature/initials modal
  const [activeField, setActiveField] = useState<SignField | null>(null)

  useEffect(() => {
    if (!assignmentId) return
    Promise.all([
      supabase.from('sign_assignments').select('*, sign_requests(title, pdf_path)').eq('id', assignmentId).single(),
      supabase.from('sign_field_values').select('field_id, value').eq('assignment_id', assignmentId),
    ]).then(async ([{ data: asgn }, { data: existingVals }]) => {
      if (!asgn) { setLoading(false); return }
      const a = asgn as unknown as Assignment
      setAssignment(a)

      // Restore any previously saved values
      if (existingVals) {
        const map: Record<string, string> = {}
        for (const v of existingVals as { field_id: string; value: string }[]) map[v.field_id] = v.value
        setValues(map)
      }

      // Get signed URL for the PDF
      const { data: urlData } = await supabase.storage.from('sign-pdfs').createSignedUrl(a.sign_requests.pdf_path, 3600)
      if (!urlData?.signedUrl) { setLoading(false); return }
      setPdfUrl(urlData.signedUrl)

      // Load PDF.js doc
      const doc = await pdfjsLib.getDocument({ url: urlData.signedUrl }).promise
      setPdfDoc(doc)
      setTotalPages(doc.numPages)

      // Load fields
      const { data: fieldData } = await supabase
        .from('sign_fields')
        .select('*')
        .eq('request_id', a.request_id)
        .order('sort_order')
      setFields((fieldData as unknown as SignField[]) ?? [])
      setLoading(false)
    })
  }, [assignmentId])

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    if (renderTaskRef.current) renderTaskRef.current.cancel()
    const p = await pdfDoc.getPage(pageNum)
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
  }, [pdfDoc])

  useEffect(() => { renderPage(page) }, [pdfDoc, page, renderPage])

  const pageFields = fields.filter((f) => f.page === page)

  function handleFieldTap(f: SignField) {
    if (f.type === 'date') {
      setValues((v) => ({ ...v, [f.id]: new Date().toLocaleDateString() }))
    } else {
      setActiveField(f)
    }
  }

  function confirmSignature() {
    if (!activeField || sigRef.current?.isEmpty()) return
    const dataUrl = sigRef.current!.toDataURL()
    setValues((v) => ({ ...v, [activeField.id]: dataUrl }))
    setActiveField(null)
  }

  const allRequired = fields.length === 0 || fields.every((f) => !!values[f.id])

  async function submit() {
    if (!assignment || !profile || !pdfUrl) return
    if (!allRequired) { setError('Please fill in all fields before submitting.'); return }
    setError(null)
    setSubmitting(true)

    try {
      // Build signed PDF with pdf-lib
      const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer())
      const pdfLibDoc = await PDFDocument.load(pdfBytes)

      for (const field of fields) {
        const val = values[field.id]
        if (!val) continue
        const pdfPage = pdfLibDoc.getPage(field.page - 1)
        const { width: pw, height: ph } = pdfPage.getSize()

        // pdf-lib origin is bottom-left; our coords are top-left
        const x = field.x * pw
        const y = (1 - field.y - field.height) * ph
        const w = field.width * pw
        const h = field.height * ph

        if (field.type === 'date') {
          pdfPage.drawText(val, {
            x: x + 4,
            y: y + h / 2 - 5,
            size: Math.min(h * 0.55, 12),
            color: rgb(0.05, 0.37, 0.25),
          })
        } else {
          // Signature / initials — embed as image
          const imgBytes = dataURLtoUint8Array(val)
          const img = await pdfLibDoc.embedPng(imgBytes)
          pdfPage.drawImage(img, { x, y, width: w, height: h })
        }
      }

      const signedBytes = await pdfLibDoc.save()
      const signedBlob = new Blob([signedBytes as unknown as BlobPart], { type: 'application/pdf' })
      const signedPath = `${profile.id}/${assignment.id}.pdf`
      await supabase.storage.from('signed-pdfs').upload(signedPath, signedBlob, { upsert: true })

      // Save field values
      if (fields.length > 0) {
        const rows = Object.entries(values).map(([fieldId, value]) => ({
          assignment_id: assignment.id,
          field_id: fieldId,
          value,
        }))
        await supabase.from('sign_field_values').upsert(rows, { onConflict: 'assignment_id,field_id' })
      }

      // Mark assignment signed
      await supabase.from('sign_assignments').update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_pdf_path: signedPath,
      }).eq('id', assignment.id)

      navigate('/forms', { state: { signed: true } })
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-gray-500 p-4">Loading…</p>
  if (!assignment) return <p className="text-gray-500 p-4">Document not found.</p>

  const title = assignment.sign_requests.title
  const alreadySigned = assignment.status === 'signed'
  const completedCount = fields.filter((f) => !!values[f.id]).length

  return (
    <>
      {/* Signature/initials modal */}
      {activeField && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800">{activeField.label}</p>
              <button onClick={() => setActiveField(null)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden h-36 bg-white">
              <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                <span>Draw your {activeField.type}</span>
                <button onClick={() => sigRef.current?.clear()} className="flex items-center gap-1 hover:text-gray-700">
                  <RotateCcw size={11} />
                  Clear
                </button>
              </div>
              <div className="h-28">
                <SignatureCanvas ref={sigRef} />
              </div>
            </div>
            <button
              onClick={confirmSignature}
              className="w-full bg-emerald-700 text-white rounded-xl py-3 font-medium"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto pb-24">
        <h1 className="text-xl font-bold text-gray-900 mb-1">{title}</h1>

        {alreadySigned ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center mt-4">
            <p className="text-emerald-700 font-semibold">You have already signed this document.</p>
          </div>
        ) : (
          <>
            {fields.length > 0 && (
              <p className="text-sm text-gray-500 mb-3">
                Tap the coloured boxes to sign. {completedCount}/{fields.length} fields completed.
              </p>
            )}

            {/* PDF canvas + field overlays */}
            <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
              <canvas ref={canvasRef} className="w-full block" />

              {/* Field overlays */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ width: canvasSize.w || '100%', height: canvasSize.h || '100%' }}
              >
                {pageFields.map((f) => {
                  const filled = !!values[f.id]
                  const c = FIELD_COLORS[f.type]
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className="absolute pointer-events-auto overflow-hidden rounded"
                      style={{
                        left: `${f.x * 100}%`,
                        top: `${f.y * 100}%`,
                        width: `${f.width * 100}%`,
                        height: `${f.height * 100}%`,
                        background: filled ? 'transparent' : c.bg,
                        border: `1.5px solid ${filled ? 'transparent' : c.border}`,
                      }}
                      onClick={() => !filled && handleFieldTap(f)}
                    >
                      {filled && f.type !== 'date' && values[f.id]?.startsWith('data:') ? (
                        <img
                          src={values[f.id]}
                          alt={f.label}
                          className="w-full h-full object-contain"
                        />
                      ) : filled && f.type === 'date' ? (
                        <span className="text-xs font-medium px-1" style={{ color: c.text }}>
                          {values[f.id]}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-1 leading-none" style={{ color: c.text, fontSize: '10px' }}>
                          {f.label}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Page nav */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-6 py-3">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="disabled:opacity-30 text-gray-600">
                  <ChevronLeft size={22} />
                </button>
                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="disabled:opacity-30 text-gray-600">
                  <ChevronRight size={22} />
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <button
              onClick={submit}
              disabled={submitting || !allRequired}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl py-3.5 font-medium shadow-sm transition-colors"
            >
              <Send size={16} />
              {submitting ? 'Saving…' : 'Submit signed document'}
            </button>
            {!allRequired && fields.length > 0 && (
              <p className="text-xs text-center text-gray-400 mt-2">
                Fill in all {fields.length} fields to submit
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
