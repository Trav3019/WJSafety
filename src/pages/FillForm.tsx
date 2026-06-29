import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { FormAssignment } from '../lib/types'

export default function FillForm() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [assignment, setAssignment] = useState<FormAssignment | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sigRef = useRef<SignatureCanvas>(null)

  useEffect(() => {
    if (!assignmentId) return
    supabase
      .from('form_assignments')
      .select('*, form_templates(*)')
      .eq('id', assignmentId)
      .single()
      .then(({ data }) => {
        setAssignment((data as unknown as FormAssignment) ?? null)
        setLoading(false)
      })
  }, [assignmentId])

  if (loading) return <p className="text-gray-500">Loading…</p>
  if (!assignment || !assignment.form_templates) return <p className="text-gray-500">Form not found.</p>

  const form = assignment.form_templates
  const alreadySubmitted = assignment.status === 'submitted'

  function setAnswer(fieldId: string, value: string | boolean) {
    setAnswers((a) => ({ ...a, [fieldId]: value }))
  }

  async function handleSubmit() {
    setError(null)
    for (const field of form.fields) {
      if (field.required && !answers[field.id]) {
        setError(`Please fill in "${field.label}"`)
        return
      }
    }
    let signatureDataUrl: string | null = null
    if (form.requires_signature) {
      if (!sigRef.current || sigRef.current.isEmpty()) {
        setError('Please sign before submitting.')
        return
      }
      signatureDataUrl = sigRef.current.toDataURL('image/png')
    }

    setSubmitting(true)
    const { error: subError } = await supabase.from('form_submissions').insert({
      assignment_id: assignment!.id,
      form_id: form.id,
      submitted_by: profile!.id,
      answers,
      signature_data_url: signatureDataUrl,
      signed_at: signatureDataUrl ? new Date().toISOString() : null,
    })

    if (!subError) {
      await supabase.from('form_assignments').update({ status: 'submitted' }).eq('id', assignment!.id)
    }
    setSubmitting(false)

    if (subError) {
      setError(subError.message)
    } else {
      navigate('/forms')
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{form.title}</h1>
      {form.description && <p className="text-gray-500 text-sm mb-4">{form.description}</p>}

      {alreadySubmitted && (
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm rounded-xl p-3.5 mb-4">
          <CheckCircle2 size={18} className="shrink-0" />
          This form has already been submitted.
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-4">
        {form.fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>
            {field.type === 'textarea' && (
              <textarea
                disabled={alreadySubmitted}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:bg-gray-50"
                rows={3}
              />
            )}
            {field.type === 'text' && (
              <input
                disabled={alreadySubmitted}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:bg-gray-50"
              />
            )}
            {field.type === 'date' && (
              <input
                type="date"
                disabled={alreadySubmitted}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:bg-gray-50"
              />
            )}
            {field.type === 'select' && (
              <select
                disabled={alreadySubmitted}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:bg-gray-50"
              >
                <option value="">Select…</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
            {field.type === 'checkbox' && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  disabled={alreadySubmitted}
                  onChange={(e) => setAnswer(field.id, e.target.checked)}
                />
                I confirm
              </label>
            )}
          </div>
        ))}

        {form.requires_signature && !alreadySubmitted && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Signature *</label>
            <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{ className: 'w-full', style: { width: '100%', height: 150 } }}
              />
            </div>
            <button
              type="button"
              onClick={() => sigRef.current?.clear()}
              className="text-xs text-gray-500 mt-1"
            >
              Clear signature
            </button>
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {!alreadySubmitted && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium shadow-sm transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit & Sign'}
          </button>
        )}
      </div>
    </div>
  )
}
