import { createClient } from '@supabase/supabase-js'
import type { Db } from '../types'

// The publishable key is meant to ship in the app; row level security keeps each person's rows private.
export const supabase = createClient(
  'https://wbngwcahxxsqqvxaqjeb.supabase.co',
  'sb_publishable_Rnoou48W2_oUU8TFq2o4gg_2NTsBFrb',
)

export const THUMB_BUCKET = 'thumbnails'

// Each record is one row in public.items, keyed "kind:id".
const KINDS = { videos: 'video', scripts: 'script', sessions: 'session', stats: 'stat' } as const
type Table = keyof typeof KINDS
type Kind = (typeof KINDS)[Table]
export type Rows = Record<string, unknown>

const TABLES = Object.keys(KINDS) as Table[]
const tableOf = (kind: Kind) => TABLES.find((t) => KINDS[t] === kind)!

export function toRows(db: Db): Rows {
  const rows: Rows = {}
  for (const t of TABLES) for (const item of db[t]) rows[`${KINDS[t]}:${item.id}`] = item
  return rows
}

export function fromRows(rows: Rows): Db {
  const db: Db = { videos: [], scripts: [], sessions: [], stats: [] }
  for (const [key, data] of Object.entries(rows)) {
    const kind = key.slice(0, key.indexOf(':')) as Kind
    ;(db[tableOf(kind)] as unknown[]).push(data)
  }
  return db
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// What changed on this device since the last time it matched the server.
export function diff(base: Rows, local: Rows) {
  const upserts = Object.keys(local).filter((k) => !same(local[k], base[k]))
  const deletes = Object.keys(base).filter((k) => !(k in local))
  return { upserts, deletes }
}

// Three-way merge: anything changed on this device since `base` wins, everything else follows the server.
export function merge(base: Rows, local: Rows, remote: Rows): Rows {
  const out: Rows = {}
  for (const k of new Set([...Object.keys(local), ...Object.keys(base), ...Object.keys(remote)])) {
    const changedHere = !same(local[k], base[k])
    const value = changedHere ? local[k] : remote[k]
    if (value !== undefined) out[k] = value
  }
  return out
}

// First sync on a device: the server wins where both have a record, and records only on this device are kept.
export function firstMerge(local: Rows, remote: Rows): Rows {
  return { ...local, ...remote }
}

export async function pullRows(): Promise<Rows> {
  const rows: Rows = {}
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from('items').select('kind,id,data').range(from, from + pageSize - 1)
    if (error) throw error
    for (const r of data) rows[`${r.kind}:${r.id}`] = r.data
    if (data.length < pageSize) return rows
  }
}

export async function pushChanges(local: Rows, upserts: string[], deletes: string[]) {
  if (upserts.length) {
    const payload = upserts.map((k) => {
      const i = k.indexOf(':')
      return { kind: k.slice(0, i), id: k.slice(i + 1), data: local[k], updated_at: new Date().toISOString() }
    })
    const { error } = await supabase.from('items').upsert(payload)
    if (error) throw error
  }
  for (const kind of new Set(deletes.map((k) => k.slice(0, k.indexOf(':'))))) {
    const ids = deletes.filter((k) => k.startsWith(kind + ':')).map((k) => k.slice(kind.length + 1))
    const { error } = await supabase.from('items').delete().eq('kind', kind).in('id', ids)
    if (error) throw error
  }
}
