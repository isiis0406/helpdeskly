import { NextRequest, NextResponse } from 'next/server'
import { apiPost } from '@/lib/app-api'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const title = String(form.get('title') || '').trim()
    const description = String(form.get('description') || '').trim()
    const priority = String(form.get('priority') || 'MEDIUM')
    const status = String(form.get('status') || 'OPEN')
    const assignedToId = form.get('assignedToId') ? String(form.get('assignedToId')) : undefined
    if (!title || !description) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    const created = await apiPost('/tickets', { title, description, priority, status, assignedToId })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Échec de la création' }, { status: 500 })
  }
}
