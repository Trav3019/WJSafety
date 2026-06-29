import Dexie, { type Table } from 'dexie'

interface CachedFile {
  storage_path: string
  blob: Blob
  cached_at: number
}

class OfflineDb extends Dexie {
  files!: Table<CachedFile, string>

  constructor() {
    super('wjsafety-offline')
    this.version(1).stores({
      files: 'storage_path, cached_at',
    })
  }
}

export const offlineDb = new OfflineDb()

export async function cacheFile(storagePath: string, blob: Blob) {
  await offlineDb.files.put({ storage_path: storagePath, blob, cached_at: Date.now() })
}

export async function getCachedFile(storagePath: string): Promise<Blob | undefined> {
  const record = await offlineDb.files.get(storagePath)
  return record?.blob
}

export async function isCached(storagePath: string): Promise<boolean> {
  return (await offlineDb.files.get(storagePath)) !== undefined
}

export async function removeCachedFile(storagePath: string) {
  await offlineDb.files.delete(storagePath)
}
