// Simple IndexedDB helper for saving/loading projects + versioning
const DB_NAME = 'studio_studio_db'
const STORE_NAME = 'projects'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
export async function saveProject(name: string, payload: any, createVersion = false) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    const getReq = store.get(name)
    getReq.onsuccess = () => {
      const existing = getReq.result
      const now = Date.now()
      if (existing) {
        // compute whether payload changed compared to current primary or last version
        const prevPrimary = existing.data
        const lastVersion = existing.versions && existing.versions.length ? existing.versions[existing.versions.length - 1].data : null
        const prevSerialized = JSON.stringify(prevPrimary)
        const newSerialized = JSON.stringify(payload)

        // update primary data
        existing.data = payload
        existing.updatedAt = now
        if (!existing.versions) existing.versions = []

        // only push a new version if requested AND the payload differs from primary or last version
        if (createVersion && (prevSerialized !== newSerialized) && (JSON.stringify(lastVersion) !== newSerialized)) {
          const vid = now
          existing.versions.push({ id: vid, data: payload, updatedAt: now })
          // cap versions to last 20
          if (existing.versions.length > 20) existing.versions = existing.versions.slice(-20)
        }

        const putReq = store.put(existing)
        putReq.onsuccess = () => resolve()
        putReq.onerror = () => reject(putReq.error)
      } else {
        const record: any = { name, data: payload, updatedAt: now, versions: [] }
        if (createVersion) record.versions.push({ id: now, data: payload, updatedAt: now })
        const putReq = store.put(record)
        putReq.onsuccess = () => resolve()
        putReq.onerror = () => reject(putReq.error)
      }
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function listProjects(): Promise<Array<{ name: string; updatedAt: number }>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => {
      const rows = req.result || []
      resolve(rows.map((r: any) => ({ name: r.name, updatedAt: r.updatedAt })))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function loadProject(name: string): Promise<any | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(name)
    req.onsuccess = () => resolve(req.result ? req.result.data : null)
    req.onerror = () => reject(req.error)
  })
}

export async function listProjectVersions(name: string): Promise<Array<{ id: number; updatedAt: number; thumb?: string | null }>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(name)
    req.onsuccess = () => {
      const rec = req.result
      if (!rec || !rec.versions) return resolve([])
      resolve(rec.versions.map((v: any) => ({ id: v.id, updatedAt: v.updatedAt, thumb: v.data && v.data.thumb ? v.data.thumb : null })))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function loadProjectVersion(name: string, versionId: number): Promise<any | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(name)
    req.onsuccess = () => {
      const rec = req.result
      if (!rec || !rec.versions) return resolve(null)
      const v = rec.versions.find((x: any) => x.id === versionId)
      resolve(v ? v.data : null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteProject(name: string) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export default { saveProject, listProjects, loadProject, deleteProject, listProjectVersions, loadProjectVersion }
