import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, Users, CheckCircle2, Clock, ChevronRight, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Profile } from '../../lib/types'
import PdfFieldEditor, { type PlacedField } from '../../components/PdfFieldEditor'

interface SignAssignment {
  id: string
  status: string
  signed_at: string | null
  profiles?: { full_name: string } | null
}

interface SignRequest {
  id: string
  title: string
  pdf_path: string
  created_at: string
  sign_assignments: SignAssignment[]
}

type Step = 'details' | 'fields'

export default function AdminSignRequests() {
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [workers, setWorkers] = useState<Profile[]>([])
  const [requests, setRequests] = useState<SignRequest[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Step 1 state
  const [step, setStep] = useState<Step>('details')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([])
  const [sendToAll, setSendToAll] = useState(false)

  // Step 2 state
  const [fields, setFields] = useState<PlacedField[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const [{ data: reqs }, { data: ws }] = await Promise.all([
      supabase
        .from('sign_requests')
        .select('*, sign_assignments(id, status, signed_at, profiles(full_name))')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('status', 'approved').neq('role', 'admin'),
    ])
    setRequests((reqs as unknown as SignRequest[]) ?? [])
    setWorkers((ws as unknown as Profile[]) ?? [])
  }

  useEffect(() => { load() }, [])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    setFilePreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  function toggleWorker(id: string) {
    setSelectedWorkers((ws) => ws.includes(id) ? ws.filter((w) => w !== id) : [...ws, id])
  }

  function goToFields(e: React.FormEvent) {
    e.preventDefault()
    const targets = sendToAll ? workers.map((w) => w.id) : selectedWorkers
    if (!file || !title.trim() || targets.length === 0) {
      setMessage('Please fill in all fields and select at least one worker.')
      return
    }
    setMessage(null)
    setStep('fields')
  }

  async function handleSend() {
    const targets = sendToAll ? workers.map((w) => w.id) : selectedWorkers
    setUploading(true)
    setMessage(null)

    const ext = file!.name.split('.').pop()
    const pdfPath = `${Date.now()}-${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('sign-pdfs').upload(pdfPath, file!)
    if (upErr) { setMessage('Upload failed: ' + upErr.message); setUploading(false); return }

    const { data: req, error: reqErr } = await supabase
      .from('sign_requests')
      .insert({ title: title.trim(), pdf_path: pdfPath, created_by: profile?.id })
      .select()
      .single()
    if (reqErr || !req) { setMessage('Failed to create sign request.'); setUploading(false); return }

    if (fields.length > 0) {
      await supabase.from('sign_fields').insert(
        fields.map((f, i) => ({
          request_id: req.id,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          type: f.type,
          label: f.label,
          sort_order: i,
        }))
      )
    }

    const rows = targets.map((workerId) => ({
      request_id: req.id,
      assigned_to: workerId,
      assigned_by: profile?.id,
    }))
    await supabase.from('sign_assignments').insert(rows)

    await Promise.allSettled(
      targets.map((workerId) =>
        supabase.functions.invoke('send-push', {
          body: { type: 'sign_assigned', title: title.trim(), user_id: workerId },
        })
      )
    )

    setTitle('')
    setFile(null)
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    setFilePreviewUrl(null)
    setSelectedWorkers([])
    setSendToAll(false)
    setFields([])
    setStep('details')
    if (fileRef.current) fileRef.current.value = ''
    setMessage(`Sent to ${targets.length} worker(s).`)
    setUploading(false)
    load()
  }

  const filteredRequests = requests.filter((r) =>
    !search.trim() || r.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">PDF Sign Requests</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-4 text-xs font-medium">
        <span className={step === 'details' ? 'text-emerald-700' : 'text-gray-400'}>
          1. Details & Workers
        </span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className={step === 'fields' ? 'text-emerald-700' : 'text-gray-400'}>
          2. Place Signature Fields
        </span>
      </div>

      {step === 'details' && (
        <form onSubmit={goToFields} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3 mb-6">
          <input
            required
            placeholder="Document title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm"
          />

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={22} className="mx-auto text-gray-400 mb-1" />
            {file ? (
              <p className="text-sm font-medium text-emerald-700">{file.name}</p>
            ) : (
              <p className="text-sm text-gray-500">Tap to select a PDF</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={pickFile}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-700">Send to</p>
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                <input type="checkbox" checked={sendToAll} onChange={(e) => setSendToAll(e.target.checked)} />
                All workers
              </label>
            </div>
            {!sendToAll && (
              <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2.5 bg-gray-50">
                {workers.map((w) => (
                  <label key={w.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedWorkers.includes(w.id)}
                      onChange={() => toggleWorker(w.id)}
                    />
                    {w.full_name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {message && <p className="text-sm text-red-600">{message}</p>}

          <button
            type="submit"
            disabled={!file || !title.trim()}
            className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium shadow-sm transition-colors"
          >
            Next: Place Fields
            <ChevronRight size={16} />
          </button>
        </form>
      )}

      {step === 'fields' && filePreviewUrl && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-4 mb-6">
          <p className="text-sm text-gray-600">
            Tap the PDF below to place signature, initials, date, or text fields. Workers will fill these in when they sign.
          </p>

          <PdfFieldEditor
            pdfUrl={filePreviewUrl}
            fields={fields}
            onChange={setFields}
          />

          {message && <p className="text-sm text-red-600">{message}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep('details')}
              className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={uploading}
              className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium shadow-sm transition-colors text-sm"
            >
              {uploading ? 'Sending…' : `Send${fields.length > 0 ? ` (${fields.length} fields)` : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Sent requests list */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase">Sent requests</h2>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search forms…"
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {message && step === 'details' && <p className="text-sm text-emerald-700 mb-2">{message}</p>}
      {filteredRequests.length === 0 && <p className="text-sm text-gray-400">No sign requests found.</p>}
      <div className="space-y-2">
        {filteredRequests.map((req) => {
          const asgns = req.sign_assignments ?? []
          const signed = asgns.filter((a) => a.status === 'signed').length
          const isOpen = expanded === req.id
          return (
            <div key={req.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : req.id)}
              >
                <div>
                  <p className="font-medium text-gray-800 text-sm">{req.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                  signed === asgns.length && asgns.length > 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  <Users size={12} />
                  {signed}/{asgns.length} signed
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
                  {asgns.length === 0 && <p className="text-xs text-gray-400">No workers assigned.</p>}
                  {asgns.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{a.profiles?.full_name ?? '—'}</span>
                      {a.status === 'signed' ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <CheckCircle2 size={13} />
                          Signed {a.signed_at ? new Date(a.signed_at).toLocaleDateString() : ''}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500 text-xs font-medium">
                          <Clock size={13} />
                          Pending
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
