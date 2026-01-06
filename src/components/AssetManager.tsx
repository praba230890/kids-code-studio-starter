import React, { useEffect, useState, useRef } from 'react'
import { saveAsset, listAssets, deleteAsset, Asset } from '../lib/storage'

export default function AssetManager() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [status, setStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    refreshAssets()
  }, [])

  const refreshAssets = async () => {
    try {
      const list = await listAssets()
      setAssets(list)
    } catch (e) {
      console.error('Failed to list assets', e)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      try {
        // Validate file type
        let type: 'image' | 'sound' | null = null
        if (file.type.startsWith('image/')) type = 'image'
        else if (file.type.startsWith('audio/')) type = 'sound'
        
        if (!type) {
          setStatus(`❌ Unsupported file type: ${file.type}`)
          continue
        }

        // Limit file size to 5MB
        if (file.size > 5 * 1024 * 1024) {
          setStatus(`❌ File too large: ${file.name} (max 5MB)`)
          continue
        }

        // Read file as data URL
        const reader = new FileReader()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const asset: Asset = {
          id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          type,
          data: dataUrl,
          size: file.size,
          uploadedAt: Date.now(),
        }

        await saveAsset(asset)
        setStatus(`✅ Uploaded ${file.name}`)
        await refreshAssets()
      } catch (e) {
        console.error('Upload failed', e)
        setStatus(`❌ Upload failed: ${file.name}`)
      }
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
    setTimeout(() => setStatus(''), 3000)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAsset(id)
      setStatus('🗑️ Asset deleted')
      await refreshAssets()
      setTimeout(() => setStatus(''), 2000)
    } catch (e) {
      console.error('Delete failed', e)
      setStatus('❌ Delete failed')
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Asset Manager</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*"
          multiple
          onChange={handleUpload}
          style={{ display: 'none' }}
          id="asset-upload"
        />
        <label htmlFor="asset-upload" style={{
          padding: '6px 12px',
          borderRadius: 4,
          background: '#2b7cff',
          color: 'white',
          cursor: 'pointer',
          fontSize: 12,
        }}>
          📤 Upload
        </label>
        <button onClick={refreshAssets} style={{ padding: '6px 12px', borderRadius: 4, fontSize: 12 }}>
          🔄 Refresh
        </button>
        {status && <span style={{ fontSize: 12, color: status.startsWith('❌') ? '#d00' : '#333' }}>{status}</span>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 4, padding: 8 }}>
        {assets.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 20, fontSize: 12 }}>
            No assets uploaded yet. Click Upload to add images or sounds.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {assets.map(asset => (
              <div key={asset.id} style={{
                border: '1px solid #eee',
                borderRadius: 6,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                position: 'relative',
              }}>
                {asset.type === 'image' ? (
                  <img
                    src={asset.data}
                    alt={asset.name}
                    style={{ width: '100%', height: 80, objectFit: 'contain', borderRadius: 4 }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f0f0f0',
                    borderRadius: 4,
                    fontSize: 32,
                  }}>🔊</div>
                )}
                <div style={{ fontSize: 10, fontWeight: 600, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                  {asset.name}
                </div>
                <div style={{ fontSize: 9, color: '#999' }}>{formatSize(asset.size)}</div>
                <input
                  readOnly
                  value={asset.id}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  style={{
                    width: '100%',
                    padding: '2px 4px',
                    fontSize: 8,
                    fontFamily: 'monospace',
                    border: '1px solid #ddd',
                    borderRadius: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: '#f9f9f9',
                  }}
                  title="Click to select asset ID"
                />
                <button
                  onClick={() => handleDelete(asset.id)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: '#ff4444',
                    color: 'white',
                    border: 'none',
                    fontSize: 10,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
