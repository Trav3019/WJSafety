import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PDFDocument, rgb } from 'pdf-lib'
import { Send, RotateCcw, X, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SignatureCanvas, { type SignatureCanvasHandle } from '../components/SignatureCanvas'
import PdfSignViewer, { type SignField } from '../components/PdfSignViewer'

interface Assignment {
  id: string
  request_id: string
  status: string
  sign_requests: { title: string; pdf_path: string }
}

const TYPE_COLORS = {
  signature: 'border-emerald-400 bg-emerald-50 text-emerald-700',
  initials:  'border-blue-400 bg-blue-50 text-blue-700',
  date:      'border-amber-400 bg-amber-50 text-amber-700',
  text:      'border-violet-400 bg-violet-50 text-violet-700',
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
  const sigRef = useRef<SignatureCanvasHandle>(null)
  const textInputRef = useRef<HTMLInputElement>(null)

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [fields, setFields] = useState<SignField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeField, setActiveField] = useState<SignField | null>(null)
  const [textDraft, setTextDraft] = useState('')

  useEffect(() => {
    if (!assignmentId) return
    Promise.all([
      supabase.from('sign_assignments').select('*, sign_requests(title, pdf_path)').eq('id', assignmentId).single(),
      supabase.from('sign_field_values').select('field_id, value').eq('assignment_id', assignmentId),
    ]).then(async ([{ data: asgn }, { data: existingVals }]) => {
      if (!asgn) { setLoading(false); return }
      const a = asgn as unknown as Assignment
      setAssignment(a)

      if (existingVals) {
        const map: Record<string, string> = {}
        for (const v of existingVals as { field_id: string; value: string }[]) map[v.field_id] = v.value
        setValues(map)
      }

      const { data: blob, error: dlError } = await supabase.storage.from('sign-pdfs').download(a.sign_requests.pdf_path)
      if (dlError || !blob) {
        setError('Could not load PDF: ' + (dlError?.message ?? 'file not found'))
        setLoading(false)
        return
      }

      const buf = await blob.arrayBuffer()
      setPdfBytes(buf)
      setPdfBlobUrl(URL.createObjectURL(blob))

      const { data: fieldData } = await supabase
        .from('sign_fields').select('*').eq('request_id', a.request_id).order('sort_order')
      setFields((fieldData as unknown as SignField[]) ?? [])
      setLoading(false)
    })
  }, [assignmentId])

  useEffect(() => () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl) }, [pdfBlobUrl])

  function handleFieldTap(f: SignField) {
    if (f.type === 'date') {
      setValues((v) => ({ ...v, [f.id]: new Date().toLocaleDateString() }))
    } else if (f.type === 'text') {
      setTextDraft(values[f.id] ?? '')
      setActiveField(f)
      setTimeout(() => textInputRef.current?.focus(), 100)
    } else {
      setActiveField(f)
    }
  }

  function confirmSignature() {
    if (!activeField || sigRef.current?.isEmpty()) return
    setValues((v) => ({ ...v, [activeField.id]: sigRef.current!.toDataURL() }))
    setActiveField(null)
  }

  function confirmText() {
    if (!activeField || !textDraft.trim()) return
    setValues((v) => ({ ...v, [activeField.id]: textDraft.trim() }))
    setActiveField(null)
    setTextDraft('')
  }

  const allFilled = fields.length === 0 || fields.every((f) => !!values[f.id])

  async function submit() {
    if (!assignment || !profile || !pdfBytes) return
    if (!allFilled) { setError('Please fill in all fields before submitting.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const pdfLibDoc = await PDFDocument.load(pdfBytes)
      for (const field of fields) {
        const val = values[field.id]
        if (!val) continue
        const pdfPage = pdfLibDoc.getPage(field.page - 1)
        const { width: pw, height: ph } = pdfPage.getSize()
        const x = field.x * pw
        const y = (1 - field.y - field.height) * ph
        const w = field.width * pw
        const h = field.height * ph
        if (field.type === 'date' || field.type === 'text') {
          const color = field.type === 'text' ? rgb(0.27, 0.18, 0.62) : rgb(0.05, 0.37, 0.25)
          pdfPage.drawText(val, { x: x + 4, y: y + h / 2 - 5, size: Math.min(h * 0.55, 12), color })
        } else {
          const img = await pdfLibDoc.embedPng(dataURLtoUint8Array(val))
          pdfPage.drawImage(img, { x, y, width: w, height: h })
        }
      }
      const signedBytes = await pdfLibDoc.save()
      const signedBlob = new Blob([signedBytes as unknown as BlobPart], { type: 'application/pdf' })
      const signedPath = `${profile.id}/${assignment.id}.pdf`
      await supabase.storage.from('signed-pdfs').upload(signedPath, signedBlob, { upsert: true })
      if (fields.length > 0) {
        await supabase.from('sign_field_values').upsert(
          Object.entries(values).map(([fieldId, value]) => ({ assignment_id: assignment.id, field_id: fieldId, value })),
          { onConflict: 'assignment_id,field_id' }
        )
      }
      await supabase.from('sign_assignments').update({
        status: 'signed', signed_at: new Date().toISOString(), signed_pdf_path: signedPath,
      }).eq('id', assignment.id)

      // Notify admins that the document was signed
      await supabase.functions.invoke('send-push', {
        body: {
          type: 'doc_signed',
          worker_name: profile.full_name,
          doc_title: assignment.sign_requests.title,
        },
      })

      navigate('/forms', { state: { signed: true } })
    } catch (e) {
      setError('Something went wrong: ' + (e instanceof Error ? e.message : String(e)))
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-gray-500 p-6 text-center">Loading document…</p>
  if (!assignment) return <p className="text-gray-500 p-4">Document not found.</p>

  const alreadySigned = assignment.status === 'signed'
  const completedCount = fields.filter((f) => !!values[f.id]).length
  const isTextField = activeField?.type === 'text'

  return (
    <>
      {/* Field modal */}
      {activeField && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800">{activeField.label}</p>
              <button onClick={() => { setActiveField(null); setTextDraft('') }}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {isTextField ? (
              <div className="space-y-3">
                <input
                  ref={textInputRef}
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  placeholder={`Enter ${activeField.label.toLowerCase()}…`}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  onKeyDown={(e) => e.key === 'Enter' && confirmText()}
                />
                <button
                  onClick={confirmText}
                  disabled={!textDraft.trim()}
                  className="w-full bg-violet-600 disabled:opacity-40 text-white rounded-xl py-3 font-medium"
                >
                  Confirm
                </button>
              </div>
            ) : (
              <>
                <div className="border border-gray-200 rounded-xl overflow-hidden h-36 bg-white">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                    <span>Draw your {activeField.type}</span>
                    <button onClick={() => sigRef.current?.clear()} className="flex items-center gap-1 hover:text-gray-700">
                      <RotateCcw size={11} /> Clear
                    </button>
                  </div>
                  <div className="h-28"><SignatureCanvas ref={sigRef} /></div>
                </div>
                <button onClick={confirmSignature} className="w-full bg-emerald-700 text-white rounded-xl py-3 font-medium">
                  Confirm
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto pb-24">
        <h1 className="text-xl font-bold text-gray-900 mb-3">{assignment.sign_requests.title}</h1>

        {alreadySigned ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <p className="text-emerald-700 font-semibold">You have already signed this document.</p>
          </div>
        ) : (
          <>
            {error && !pdfBlobUrl && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* PDF with interactive field overlays */}
            {pdfBlobUrl && (
              <PdfSignViewer
                blobUrl={pdfBlobUrl}
                fields={fields}
                values={values}
                onFieldTap={handleFieldTap}
              />
            )}

            {/* Progress summary */}
            {fields.length > 0 && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-600">
                    {completedCount}/{fields.length} fields completed
                  </p>
                  {allFilled && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 size={13} /> All done
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {fields.map((f) => {
                    const filled = !!values[f.id]
                    const colors = TYPE_COLORS[f.type as keyof typeof TYPE_COLORS] ?? 'border-gray-300 bg-gray-50 text-gray-600'
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleFieldTap(f)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                          filled ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : colors
                        }`}
                      >
                        {filled && <CheckCircle2 size={11} />}
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <button
              onClick={submit}
              disabled={submitting || !allFilled}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl py-3.5 font-medium shadow-sm transition-colors"
            >
              <Send size={16} />
              {submitting ? 'Saving…' : 'Submit signed document'}
            </button>
            {!allFilled && fields.length > 0 && (
              <p className="text-xs text-center text-gray-400 mt-2">
                Tap the highlighted fields on the document above to fill them in
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
