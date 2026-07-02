import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RotateCcw, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PdfViewer from '../components/PdfViewer'
import SignatureCanvas, { type SignatureCanvasHandle } from '../components/SignatureCanvas'

interface Assignment {
  id: string
  request_id: string
  status: string
  sign_requests: { title: string; pdf_path: string }
}

export default function SignDoc() {
  const { assignmentId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const sigRef = useRef<SignatureCanvasHandle>(null)

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPdf, setShowPdf] = useState(false)

  useEffect(() => {
    if (!assignmentId) return
    supabase
      .from('sign_assignments')
      .select('*, sign_requests(title, pdf_path)')
      .eq('id', assignmentId)
      .single()
      .then(async ({ data, error: err }) => {
        if (err || !data) { setLoading(false); return }
        const asgn = data as unknown as Assignment
        setAssignment(asgn)

        // Get a signed download URL for the private PDF
        const { data: urlData } = await supabase.storage
          .from('sign-pdfs')
          .createSignedUrl(asgn.sign_requests.pdf_path, 3600)
        if (urlData?.signedUrl) setPdfUrl(urlData.signedUrl)
        setLoading(false)
      })
  }, [assignmentId])

  async function submit() {
    if (!assignment || !profile) return
    if (sigRef.current?.isEmpty()) {
      setError('Please sign before submitting.')
      return
    }
    setError(null)
    setSubmitting(true)

    // Convert signature to blob and upload
    const dataUrl = sigRef.current!.toDataURL()
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const sigPath = `${profile.id}/${assignment.id}.png`
    const { error: upErr } = await supabase.storage.from('signatures').upload(sigPath, blob, { upsert: true })
    if (upErr) { setError('Could not upload signature.'); setSubmitting(false); return }

    const { error: updErr } = await supabase
      .from('sign_assignments')
      .update({ status: 'signed', signature_path: sigPath, signed_at: new Date().toISOString() })
      .eq('id', assignment.id)

    if (updErr) { setError('Could not save signature.'); setSubmitting(false); return }
    navigate('/forms', { state: { signed: true } })
  }

  if (loading) return <p className="text-gray-500 p-4">Loading…</p>
  if (!assignment) return <p className="text-gray-500 p-4">Document not found.</p>

  const title = assignment.sign_requests.title
  const alreadySigned = assignment.status === 'signed'

  return (
    <>
      {showPdf && pdfUrl && (
        <PdfViewer url={pdfUrl} title={title} onClose={() => setShowPdf(false)} />
      )}

      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-1">{title}</h1>
        <p className="text-sm text-gray-500 mb-4">Read the document, then sign below.</p>

        {/* View PDF button */}
        {pdfUrl && (
          <button
            onClick={() => setShowPdf(true)}
            className="w-full mb-4 border-2 border-emerald-300 rounded-xl py-3 text-emerald-700 font-medium text-sm hover:bg-emerald-50 transition-colors"
          >
            View PDF document
          </button>
        )}

        {alreadySigned ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <p className="text-emerald-700 font-semibold">You have already signed this document.</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-medium text-gray-600">Sign here</p>
                <button
                  onClick={() => sigRef.current?.clear()}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <RotateCcw size={12} />
                  Clear
                </button>
              </div>
              <div className="h-40 bg-white">
                <SignatureCanvas ref={sigRef} />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl py-3 font-medium shadow-sm transition-colors"
            >
              <Send size={16} />
              {submitting ? 'Submitting…' : 'Submit signature'}
            </button>
          </>
        )}
      </div>
    </>
  )
}
