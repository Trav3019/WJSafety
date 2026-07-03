import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const INCIDENT_TYPES = ['Injury', 'Near Miss', 'Property Damage', 'Environmental', 'Other']
const MEDICAL_OPTIONS = ['None', 'First Aid Only', 'Doctor / Medical Centre Visit', 'Hospitalisation']

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white'
const textareaCls = `${inputCls} resize-none`

export default function IncidentReport() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const sigCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [hasSig, setHasSig] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Size canvas to its displayed size and wire up non-passive touch events
  useEffect(() => {
    const canvas = sigCanvasRef.current
    if (!canvas) return

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = width
      canvas.height = height
    }
    resize()

    function getXY(e: TouchEvent | MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const src = e instanceof TouchEvent ? e.touches[0] : e
      return { x: src.clientX - rect.left, y: src.clientY - rect.top }
    }

    function onStart(e: TouchEvent | MouseEvent) {
      e.preventDefault()
      const ctx = canvas!.getContext('2d')!
      const { x, y } = getXY(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
      drawingRef.current = true
      setHasSig(true)
    }

    function onMove(e: TouchEvent | MouseEvent) {
      if (!drawingRef.current) return
      e.preventDefault()
      const ctx = canvas!.getContext('2d')!
      const { x, y } = getXY(e)
      ctx.lineTo(x, y)
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }

    function onEnd() { drawingRef.current = false }

    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd)
    canvas.addEventListener('mousedown', onStart)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseup', onEnd)
    canvas.addEventListener('mouseleave', onEnd)

    return () => {
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
      canvas.removeEventListener('mousedown', onStart)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseup', onEnd)
      canvas.removeEventListener('mouseleave', onEnd)
    }
  }, [])

  const [form, setForm] = useState({
    incident_date: '',
    incident_time: '',
    location: '',
    incident_type: '',
    description: '',
    persons_involved: '',
    witnesses: '',
    injury_details: '',
    medical_treatment: 'None',
    equipment_involved: '',
    contributing_factors: '',
    corrective_actions: '',
    reporter_phone: '',
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function clearSig() {
    const canvas = sigCanvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.incident_date || !form.incident_time || !form.location || !form.incident_type || !form.description) {
      alert('Please fill in all required fields.')
      return
    }
    setSubmitting(true)

    const signature_data_url = hasSig ? sigCanvasRef.current!.toDataURL() : null

    const { error } = await supabase.from('incident_reports').insert({
      submitted_by: profile?.id,
      data: {
        ...form,
        reporter_name: profile?.full_name,
        signature_data_url,
      },
    })

    if (error) {
      alert('Failed to submit: ' + error.message)
      setSubmitting(false)
      return
    }

    // Notify admins
    supabase.functions.invoke('Send-Push', {
      body: {
        type: 'incident_submitted',
        worker_name: profile?.full_name ?? 'A worker',
        incident_type: form.incident_type,
      },
    })

    setDone(true)
    setSubmitting(false)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
        <div className="bg-emerald-100 text-emerald-600 rounded-full p-4">
          <Send size={28} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Report Submitted</h2>
        <p className="text-gray-500 text-sm max-w-xs">Your incident report has been sent to the admin for review.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 bg-emerald-700 text-white px-6 py-2.5 rounded-full font-medium text-sm"
        >
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="text-red-600 text-sm mb-3 inline-flex items-center gap-1 font-medium"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={20} className="text-red-600" />
        <h1 className="text-xl font-bold text-gray-900">Incident Report</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">Complete all required fields and submit. The admin will be notified immediately.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Incident Details</h2>

          <Field label="Date" required>
            <input type="date" className={inputCls} value={form.incident_date} onChange={(e) => set('incident_date', e.target.value)} required />
          </Field>
          <Field label="Time" required>
            <input type="time" className={inputCls} value={form.incident_time} onChange={(e) => set('incident_time', e.target.value)} required />
          </Field>

          <Field label="Location on Farm" required>
            <input type="text" className={inputCls} placeholder="e.g. Dairy shed, Paddock 4" value={form.location} onChange={(e) => set('location', e.target.value)} required />
          </Field>

          <Field label="Type of Incident" required>
            <select className={inputCls} value={form.incident_type} onChange={(e) => set('incident_type', e.target.value)} required>
              <option value="">Select type…</option>
              {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Description of What Happened" required>
            <textarea className={textareaCls} rows={4} placeholder="Describe the incident clearly…" value={form.description} onChange={(e) => set('description', e.target.value)} required />
          </Field>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">People & Injuries</h2>

          <Field label="Persons Involved (Name & Role)">
            <textarea className={textareaCls} rows={2} placeholder="e.g. John Smith – Farm hand" value={form.persons_involved} onChange={(e) => set('persons_involved', e.target.value)} />
          </Field>

          <Field label="Witnesses">
            <textarea className={textareaCls} rows={2} placeholder="Names of any witnesses" value={form.witnesses} onChange={(e) => set('witnesses', e.target.value)} />
          </Field>

          <Field label="Injury / Illness Details">
            <textarea className={textareaCls} rows={2} placeholder="Nature of injury, body part affected…" value={form.injury_details} onChange={(e) => set('injury_details', e.target.value)} />
          </Field>

          <Field label="Medical Treatment Required">
            <select className={inputCls} value={form.medical_treatment} onChange={(e) => set('medical_treatment', e.target.value)}>
              {MEDICAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Equipment & Actions</h2>

          <Field label="Equipment / Materials Involved">
            <input type="text" className={inputCls} placeholder="e.g. Tractor, chemical spray" value={form.equipment_involved} onChange={(e) => set('equipment_involved', e.target.value)} />
          </Field>

          <Field label="Contributing Factors">
            <textarea className={textareaCls} rows={2} placeholder="What contributed to this incident?" value={form.contributing_factors} onChange={(e) => set('contributing_factors', e.target.value)} />
          </Field>

          <Field label="Corrective Actions Taken">
            <textarea className={textareaCls} rows={2} placeholder="What was done immediately to prevent recurrence?" value={form.corrective_actions} onChange={(e) => set('corrective_actions', e.target.value)} />
          </Field>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Reporter Details</h2>
          <p className="text-xs text-gray-400">Name: <span className="font-medium text-gray-600">{profile?.full_name}</span></p>
          <Field label="Phone Number">
            <input type="tel" className={inputCls} placeholder="e.g. 027 123 4567" value={form.reporter_phone} onChange={(e) => set('reporter_phone', e.target.value)} />
          </Field>

          <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 select-none" style={{ height: 120 }}>
            <canvas ref={sigCanvasRef} className="w-full h-full block cursor-crosshair" />
          </div>
          {hasSig ? (
            <button type="button" onClick={clearSig} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear signature</button>
          ) : (
            <p className="text-xs text-gray-400">Draw your signature above (optional)</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-3 font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <Send size={16} />
          {submitting ? 'Submitting…' : 'Submit Incident Report'}
        </button>
      </form>
    </div>
  )
}
