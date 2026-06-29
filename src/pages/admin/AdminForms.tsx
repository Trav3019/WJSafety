import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { FieldType, FormField, FormTemplate, Profile } from '../../lib/types'

function newField(): FormField {
  return { id: crypto.randomUUID(), label: '', type: 'text', required: true }
}

export default function AdminForms() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [workers, setWorkers] = useState<Profile[]>([])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requiresSignature, setRequiresSignature] = useState(true)
  const [fields, setFields] = useState<FormField[]>([newField()])
  const [saving, setSaving] = useState(false)

  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function loadTemplates() {
    const { data } = await supabase.from('form_templates').select('*').order('created_at', { ascending: false })
    setTemplates((data as unknown as FormTemplate[]) ?? [])
  }

  useEffect(() => {
    loadTemplates()
    supabase
      .from('profiles')
      .select('*')
      .eq('status', 'approved')
      .then(({ data }) => setWorkers(data ?? []))
  }, [])

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('form_templates').insert({
      title,
      description: description || null,
      fields,
      requires_signature: requiresSignature,
      created_by: profile?.id,
    })
    setSaving(false)
    setTitle('')
    setDescription('')
    setFields([newField()])
    loadTemplates()
  }

  function toggleWorker(id: string) {
    setSelectedWorkers((ws) => (ws.includes(id) ? ws.filter((w) => w !== id) : [...ws, id]))
  }

  async function sendForm(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTemplate || selectedWorkers.length === 0) return
    setAssigning(true)
    const rows = selectedWorkers.map((workerId) => ({
      form_id: selectedTemplate,
      assigned_to: workerId,
      assigned_by: profile?.id,
      due_date: dueDate || null,
    }))
    const { error } = await supabase.from('form_assignments').insert(rows)
    setAssigning(false)
    setMessage(error ? error.message : `Sent to ${selectedWorkers.length} worker(s).`)
    setSelectedWorkers([])
  }

  return (
    <div>
      <Link to="/admin" className="text-emerald-700 text-sm mb-3 inline-flex items-center gap-1 font-medium">
        <ArrowLeft size={15} />
        Admin
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Forms</h1>

      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Build a new form</h2>
      <form onSubmit={saveTemplate} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3 mb-6">
        <input
          required
          placeholder="Form title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
        />

        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="border border-gray-200 rounded-lg p-2.5 space-y-2 bg-gray-50">
              <div className="flex gap-2">
                <input
                  placeholder={`Field ${i + 1} label`}
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Long text</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFields((fs) => fs.filter((f) => f.id !== field.id))}
                  className="text-red-500 hover:bg-red-50 rounded-md p-1.5 transition-colors"
                  aria-label="Remove field"
                >
                  <X size={15} />
                </button>
              </div>
              {field.type === 'select' && (
                <input
                  placeholder="Options, comma separated"
                  onChange={(e) =>
                    updateField(field.id, { options: e.target.value.split(',').map((s) => s.trim()) })
                  }
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                />
              )}
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(field.id, { required: e.target.checked })}
                />
                Required
              </label>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFields((fs) => [...fs, newField()])}
          className="flex items-center gap-1 text-sm text-emerald-700 font-medium"
        >
          <Plus size={15} />
          Add field
        </button>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={requiresSignature}
            onChange={(e) => setRequiresSignature(e.target.checked)}
          />
          Requires signature
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium shadow-sm transition-colors"
        >
          {saving ? 'Saving…' : 'Save form'}
        </button>
      </form>

      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Send a form for signature</h2>
      <form onSubmit={sendForm} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3">
        <select
          required
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
        >
          <option value="">Choose a form…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Send to</p>
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
        </div>

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
        />

        {message && <p className="text-sm text-emerald-700">{message}</p>}

        <button
          type="submit"
          disabled={assigning}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium shadow-sm transition-colors"
        >
          {assigning ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
