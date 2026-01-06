import React, { useEffect, useRef, useState } from 'react'
import { SimulationRuntime } from '../lib/simulationRuntime'
import { extractEventHandlers, handlersToScript } from '../lib/blocklyCodegen'
import { saveProject, listProjects, loadProject, deleteProject, listProjectVersions, loadProjectVersion } from '../lib/storage'
import ComparePanel from './ComparePanel'

interface BlocklyPanelProps {
  runtime: SimulationRuntime | null
}

export default function BlocklyPanel({ runtime }: BlocklyPanelProps) {
  const divRef = useRef<HTMLDivElement | null>(null)
  const workspaceRef = useRef<any>(null)
  const [compilationStatus, setCompilationStatus] = useState('')
  const [projects, setProjects] = useState<string[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [autosaveEnabled, setAutosaveEnabled] = useState(false)
  const [autosaveInterval, setAutosaveInterval] = useState(5000)
  const autosaveRef = useRef<number | null>(null)
  const [versions, setVersions] = useState<Array<{ id: number; updatedAt: number }>>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [showDiffPreview, setShowDiffPreview] = useState(false)
  const [versionThumb, setVersionThumb] = useState<string | null>(null)
  const [currentThumb, setCurrentThumb] = useState<string | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareLeftXml, setCompareLeftXml] = useState<string>('')
  const [compareRightXml, setCompareRightXml] = useState<string>('')
  const mouseMoveRef = useRef<(e: MouseEvent) => void>()
  const mouseUpRef = useRef<(e: MouseEvent) => void>()

  // Small inline component to render diff results from a compute function
  function DiffRenderer({ compute }: { compute: () => Promise<Array<{ line: string; type: string }>> }) {
    const [items, setItems] = useState<Array<{ line: string; type: string }>>([])
    useEffect(() => {
      let mounted = true
      compute().then((d) => { if (mounted) setItems(d as any) }).catch(() => {})
      return () => { mounted = false }
    }, [compute])

    return (
      <div>
        {items.map((it, i) => (
          <div key={i} style={{ color: it.type === 'added' ? 'green' : it.type === 'removed' ? 'red' : '#333' }}>{it.type === 'added' ? '+ ' : it.type === 'removed' ? '- ' : '  '}{it.line}</div>
        ))}
      </div>
    )
  }

  useEffect(() => {
    let workspace: any = null
    async function loadBlockly() {
      try {
        let Blockly: any = await import('blockly')
        // load JS generator and ensure it's attached to this Blockly instance
        const jsModule = await import('blockly/javascript')
        // Some builds export a factory function as default that attaches generators to Blockly.
        // If so, call it with our Blockly instance so generators are registered on the same instance.
        try {
          const maybeFactory = (jsModule as any).default || (jsModule as any)
          if (typeof maybeFactory === 'function') {
            // call factory with Blockly; many builds return nothing but attach to Blockly
            maybeFactory(Blockly)
          }
        } catch (e) {
          console.warn('blockly/javascript factory call failed (non-fatal)', e)
        }

        // Now read the generator object from known places
        const detectedJsGen = (jsModule as any).JavaScript || (jsModule as any).default && (jsModule as any).default.JavaScript || (Blockly as any).JavaScript || (window as any).Blockly && (window as any).Blockly.JavaScript
        if (detectedJsGen) {
          ;(Blockly as any).JavaScript = detectedJsGen
        }

        // If generator still not present, fallback to loading UMD build from CDN
        const hasJS = (Blockly as any).JavaScript && typeof (Blockly as any).JavaScript.statementToCode === 'function'
        if (!hasJS) {
          console.warn('Blockly JS generator not detected via ESM imports — falling back to CDN UMD builds')

          const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`)
            if (existing) return resolve()
            const s = document.createElement('script')
            s.src = src
            s.async = true
            s.onload = () => resolve()
            s.onerror = (e) => reject(e)
            document.head.appendChild(s)
          })

          // use unpkg CDN; explicit version can be added if desired
          try {
            await loadScript('https://unpkg.com/blockly/blockly.min.js')
            await loadScript('https://unpkg.com/blockly/javascript.js')
            // reassign Blockly to global one
            Blockly = (window as any).Blockly
            console.debug('Loaded Blockly UMD from CDN, Blockly keys:', Object.keys(Blockly || {}).slice(0, 30))
          } catch (e) {
            console.error('Failed to load Blockly UMD from CDN', e)
          }
        }

        // register custom blocks using the final Blockly instance
        const blocksModule = await import('../lib/simulationBlocks')
        blocksModule.registerSimulationBlocks(Blockly)

        const toolbox = {
          kind: 'flyoutToolbox',
          contents: [
            { kind: 'block', type: 'sim_on_start' },
            { kind: 'block', type: 'sim_on_update' },
            { kind: 'block', type: 'sim_set_property' },
            { kind: 'block', type: 'sim_get_property' },
            { kind: 'block', type: 'sim_log' },
            { kind: 'block', type: 'sim_load_image' },
            { kind: 'block', type: 'sim_create_sprite' },
            { kind: 'block', type: 'math_number' },
            { kind: 'block', type: 'math_arithmetic' },
            { kind: 'block', type: 'controls_if' },
            { kind: 'block', type: 'text' },
          ],
        }

        // ensure previous workspace is disposed and container cleared
        if (workspaceRef.current) {
          try { workspaceRef.current.dispose(); } catch (e) {}
          workspaceRef.current = null
        }
        if (divRef.current) divRef.current.innerHTML = ''

        if (divRef.current) {
          workspace = (Blockly as any).inject(divRef.current, {
            toolbox,
            collapse: true,
            comments: true,
            disable: true,
            maxBlocks: Infinity,
            trashcan: true,
            zoom: { controls: true, wheel: true, startScale: 0.8 },
          })

          // attach the Blockly module to the workspace
          ;(workspace as any).__blockly = Blockly
          
          // Trigger resize after injection to ensure proper sizing
          setTimeout(() => {
            if (workspace && typeof workspace.resize === 'function') {
              workspace.resize()
            }
          }, 100)

          // resolve the actual JS generator object. Some builds export a factory function
          // or different shapes; normalize to an object that has `statementToCode`.
          let jsGen: any = detectedJsGen || (Blockly as any).JavaScript || (window as any).Blockly && (window as any).Blockly.JavaScript

          if (typeof jsGen === 'function') {
            try {
              const maybe = jsGen(Blockly)
              if (maybe && typeof maybe.statementToCode === 'function') {
                jsGen = maybe
              } else if ((Blockly as any).JavaScript && typeof (Blockly as any).JavaScript.statementToCode === 'function') {
                jsGen = (Blockly as any).JavaScript
              }
            } catch (e) {
              // ignore - we'll fallback to any attached generator
            }
          }

          ;(workspace as any).__jsGen = jsGen
          console.debug('Attached Blockly JS generator to workspace:', {
            hasStatementToCode: !!(jsGen && typeof jsGen.statementToCode === 'function'),
            jsGenType: typeof jsGen,
            jsGenKeys: jsGen ? Object.keys(jsGen).slice(0, 20) : null,
          })

          workspaceRef.current = workspace
          
          // Add resize observer to handle dynamic resizing
          if (divRef.current) {
            let resizeTimeout: number | null = null
            const resizeObserver = new ResizeObserver(() => {
              // Debounce resize calls
              if (resizeTimeout) window.clearTimeout(resizeTimeout)
              resizeTimeout = window.setTimeout(() => {
                const ws = workspaceRef.current
                if (ws && typeof ws.resize === 'function') {
                  ws.resize()
                  const Blockly = (ws as any).__blockly
                  if (Blockly && Blockly.svgResize) {
                    Blockly.svgResize(ws)
                  }
                }
              }, 50)
            })
            resizeObserver.observe(divRef.current)
            // Store cleanup function
            ;(workspace as any).__resizeObserver = resizeObserver
          }
          
          // refresh saved projects list once workspace is available
          try {
            const rows = await listProjects()
            setProjects(rows.map(r => r.name))
            if (rows.length) setSelectedProject(rows[0].name)
          } catch (e) { /* ignore */ }
        }
      } catch (err) {
        console.error('Blockly load error:', err)
        if (divRef.current) divRef.current.innerText = 'Blockly failed to load. Check console.'
      }
    }

    loadBlockly()

    return () => {
      if (workspaceRef.current) {
        // Cleanup resize observer
        const resizeObserver = (workspaceRef.current as any).__resizeObserver
        if (resizeObserver) {
          resizeObserver.disconnect()
        }
        workspaceRef.current.dispose()
        workspaceRef.current = null
      }
      // cleanup listeners if any
      if (mouseMoveRef.current) window.removeEventListener('mousemove', mouseMoveRef.current)
      if (mouseUpRef.current) window.removeEventListener('mouseup', mouseUpRef.current)
    }
  }, [])

  const handleCompile = async () => {
    if (!workspaceRef.current || !runtime) {
      setCompilationStatus('❌ Missing workspace or runtime')
      return
    }

    try {
      // Clear all existing objects before compiling new blocks
      const context = runtime.getContext()
      const objectIds = Array.from(context.objects.keys())
      objectIds.forEach(id => runtime.removeObject(id))
      
      // Diagnostic: inspect workspace blocks
      const ws = workspaceRef.current
      const allBlocks = ws.getAllBlocks(false) || []
      const types = allBlocks.map((b: any) => b.type)
      console.debug('Blockly workspace blocks:', allBlocks)
      console.debug('Block types:', types)

      // Extract event handlers from workspace (pass JS generator attached to workspace)
      const jsGen = ws && (ws as any).__jsGen || (ws && (ws as any).__blockly && (ws as any).__blockly.JavaScript)
      const handlers = extractEventHandlers(ws, jsGen)

      if (Object.keys(handlers).length === 0) {
        setCompilationStatus(`⚠️ No event handlers found — ${allBlocks.length} blocks detected: ${types.join(', ')}`)
        return
      }

      // Try loading handlers into sandboxed worker (preferred)
      try {
        await runtime.loadScriptInSandbox(handlers as any)
      } catch (e) {
        console.warn('Sandbox load failed, falling back to in-process compile', e)
        // Compile handlers into script functions as a fallback
        const context = runtime.getContext()
        const scriptFunctions = handlersToScript(handlers, context)
        runtime.loadScript(scriptFunctions)
      }
      setCompilationStatus('✅ Compiled successfully!')

      setTimeout(() => setCompilationStatus(''), 2000)
    } catch (err) {
      console.error('Compilation error:', err)
      setCompilationStatus(`❌ ${(err as any).message}`)
    }
  }

  const refreshProjects = async () => {
    try {
      const rows = await listProjects()
      setProjects(rows.map(r => r.name))
      if (rows.length && !selectedProject) setSelectedProject(rows[0].name)
    } catch (e) { console.warn('Failed to list projects', e) }
  }

  const handleSaveProject = async () => {
    if (!workspaceRef.current) { setCompilationStatus('❌ No workspace'); return }
    const ws = workspaceRef.current
    const Blockly = (ws as any).__blockly
    if (!Blockly) { setCompilationStatus('❌ Blockly not ready'); return }
    const name = projectName.trim() || `project-${Date.now()}`
    try {
      const dom = Blockly.Xml.workspaceToDom(ws)
      const xml = Blockly.Xml.domToText(dom)
      // generate a small SVG thumbnail showing block count
      const blockCount = (ws.getAllBlocks && ws.getAllBlocks(false) || []).length
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140"><rect width="100%" height="100%" fill="#f8f9fa" stroke="#ddd"/><text x="12" y="28" font-size="14" fill="#333">${name}</text><text x="12" y="56" font-size="12" fill="#666">blocks: ${blockCount}</text></svg>`
      const thumb = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
      await saveProject(name, { xml, thumb }, true)
      setCompilationStatus('💾 Project saved')
      setProjectName('')
      await refreshProjects()
      // refresh versions for this project
      try { const vs = await listProjectVersions(name); setVersions(vs); if (vs.length) { setSelectedVersion(vs[0].id); setVersionThumb((vs[0] as any).thumb || null) } } catch (e) {}
      setTimeout(() => setCompilationStatus(''), 2000)
    } catch (e) {
      console.error('Save failed', e)
      setCompilationStatus('❌ Save failed')
    }
  }

  const handleLoadProject = async () => {
    if (!workspaceRef.current) { setCompilationStatus('❌ No workspace'); return }
    if (!selectedProject) { setCompilationStatus('❌ Select a project'); return }
    const ws = workspaceRef.current
    const Blockly = (ws as any).__blockly
    if (!Blockly) { setCompilationStatus('❌ Blockly not ready'); return }
    try {
      const data = await loadProject(selectedProject)
      if (!data || !data.xml) { setCompilationStatus('❌ No project data'); return }
      ws.clear()
      // Some Blockly builds don't expose `Blockly.Xml.textToDom`; use DOMParser as fallback
      let dom: any = null
      try {
        if (Blockly.Xml && typeof (Blockly.Xml as any).textToDom === 'function') {
          dom = (Blockly.Xml as any).textToDom(data.xml)
        } else {
          const parser = new DOMParser()
          const doc = parser.parseFromString(data.xml, 'text/xml')
          dom = doc.documentElement
        }
      } catch (e) {
        console.error('Failed to parse project XML', e)
        setCompilationStatus('❌ Invalid project XML')
        return
      }

      if (!dom) { setCompilationStatus('❌ Invalid project DOM'); return }
      Blockly.Xml.domToWorkspace(dom, ws)
      // refresh versions list
      try { const vs = await listProjectVersions(selectedProject); setVersions(vs); if (vs.length) { setSelectedVersion(vs[0].id); setVersionThumb((vs[0] as any).thumb || null) } } catch (e) {}
      setCompilationStatus('📥 Project loaded')
      setTimeout(() => setCompilationStatus(''), 2000)
    } catch (e) {
      console.error('Load failed', e)
      setCompilationStatus('❌ Load failed')
    }
  }

  const handleDeleteProject = async () => {
    if (!selectedProject) { setCompilationStatus('❌ Select a project'); return }
    try {
      await deleteProject(selectedProject)
      setCompilationStatus('🗑️ Project deleted')
      await refreshProjects()
      setTimeout(() => setCompilationStatus(''), 1200)
    } catch (e) {
      console.error('Delete failed', e)
      setCompilationStatus('❌ Delete failed')
    }
  }

  const handleListVersions = async () => {
    if (!selectedProject) return
    try {
      const vs = await listProjectVersions(selectedProject)
      setVersions(vs)
      if (vs.length) { setSelectedVersion(vs[0].id); setVersionThumb((vs[0] as any).thumb || null) }
    } catch (e) {
      console.warn('Failed to list versions', e)
    }
  }

  const handleRestoreVersion = async () => {
    if (!workspaceRef.current) { setCompilationStatus('❌ No workspace'); return }
    if (!selectedProject || !selectedVersion) { setCompilationStatus('❌ Select project and version'); return }
    const ws = workspaceRef.current
    const Blockly = (ws as any).__blockly
    if (!Blockly) { setCompilationStatus('❌ Blockly not ready'); return }
    try {
      const data = await loadProjectVersion(selectedProject, selectedVersion)
      if (!data || !data.xml) { setCompilationStatus('❌ No version data'); return }
      ws.clear()
      let dom: any = null
      try {
        if (Blockly.Xml && typeof (Blockly.Xml as any).textToDom === 'function') dom = (Blockly.Xml as any).textToDom(data.xml)
        else {
          const parser = new DOMParser()
          const doc = parser.parseFromString(data.xml, 'text/xml')
          dom = doc.documentElement
        }
      } catch (e) { setCompilationStatus('❌ Invalid version XML'); return }
      Blockly.Xml.domToWorkspace(dom, ws)
      // update current thumbnail
      try {
        const cnt = (ws.getAllBlocks && ws.getAllBlocks(false) || []).length
        const svgCur = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140"><rect width="100%" height="100%" fill="#fff" stroke="#ddd"/><text x="12" y="28" font-size="14" fill="#333">${selectedProject}</text><text x="12" y="56" font-size="12" fill="#666">blocks: ${cnt}</text></svg>`
        setCurrentThumb('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgCur))))
      } catch (e) {}
      setCompilationStatus('🔁 Version restored')
      setTimeout(() => setCompilationStatus(''), 2000)
    } catch (e) {
      console.error('Restore failed', e)
      setCompilationStatus('❌ Restore failed')
    }
  }

  const computeDiffPreview = async () => {
    if (!workspaceRef.current || !selectedProject || !selectedVersion) return []
    const ws = workspaceRef.current
    const Blockly = (ws as any).__blockly
    if (!Blockly) return []
    const currDom = Blockly.Xml.workspaceToDom(ws)
    const currXml = Blockly.Xml.domToText(currDom)
    const ver = await loadProjectVersion(selectedProject, selectedVersion)
    if (!ver || !ver.xml) return []
    const a = ver.xml.split('\n').map((l: string) => l.trim()).filter(Boolean)
    const b = currXml.split('\n').map((l: string) => l.trim()).filter(Boolean)
    const aSet = new Set(a)
    const bSet = new Set(b)
    const all = Array.from(new Set([...a, ...b]))
    const diffs: Array<{ line: string; type: 'added' | 'removed' | 'common' }> = []
    for (const line of all) {
      if (aSet.has(line) && bSet.has(line)) diffs.push({ line, type: 'common' })
      else if (aSet.has(line)) diffs.push({ line, type: 'removed' })
      else diffs.push({ line, type: 'added' })
    }
    return diffs
  }

  const handleCompareVersion = async () => {
    if (!workspaceRef.current || !selectedProject || !selectedVersion) {
      setCompilationStatus('❌ Select project and version')
      return
    }
    const ws = workspaceRef.current
    const Blockly = (ws as any).__blockly
    if (!Blockly) {
      console.error('Blockly not attached to workspace')
      return
    }
    try {
      const currDom = Blockly.Xml.workspaceToDom(ws)
      const currXml = Blockly.Xml.domToText(currDom)
      console.log('Current XML length:', currXml.length)
      
      const versionData = await loadProjectVersion(selectedProject, selectedVersion)
      console.log('Loaded version data:', versionData)
      
      if (!versionData || !versionData.xml) {
        console.error('No version data found')
        setCompilationStatus('❌ No version data')
        return
      }
      
      console.log('Version XML length:', versionData.xml.length)
      setCompareLeftXml(currXml)
      setCompareRightXml(versionData.xml)
      setCompareOpen(true)
    } catch (e) {
      console.error('Compare failed', e)
      setCompilationStatus('❌ Compare failed')
    }
  }

  // autosave effect
  useEffect(() => {
    if (!autosaveEnabled || !selectedProject) return
    if (autosaveRef.current) window.clearInterval(autosaveRef.current)
    autosaveRef.current = window.setInterval(async () => {
      if (!workspaceRef.current) return
      const ws = workspaceRef.current
      const Blockly = (ws as any).__blockly
      if (!Blockly) return
      try {
        const dom = Blockly.Xml.workspaceToDom(ws)
        const xml = Blockly.Xml.domToText(dom)
        await saveProject(selectedProject, { xml }, true)
        const vs = await listProjectVersions(selectedProject)
        setVersions(vs)
      } catch (e) {
        console.warn('Autosave failed', e)
      }
    }, autosaveInterval)

    return () => {
      if (autosaveRef.current) { window.clearInterval(autosaveRef.current); autosaveRef.current = null }
    }
  }, [autosaveEnabled, autosaveInterval, selectedProject])

  return (
    <div style={{ width: '100%', padding: 8, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Blocks</div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          placeholder="Project name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', flex: '1 0 140px' }}
        />
        <button onClick={handleSaveProject} style={{ padding: '6px 8px', borderRadius: 4 }}>💾 Save</button>
        <select value={selectedProject || ''} onChange={(e) => setSelectedProject(e.target.value)} style={{ padding: '6px 8px', borderRadius: 4 }}>
          <option value="">-- Saved projects --</option>
          {projects.map((p) => (<option key={p} value={p}>{p}</option>))}
        </select>
        <button onClick={handleLoadProject} style={{ padding: '6px 8px', borderRadius: 4 }}>📥 Load</button>
        <button onClick={handleDeleteProject} style={{ padding: '6px 8px', borderRadius: 4 }}>🗑️</button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={autosaveEnabled} onChange={(e) => setAutosaveEnabled(e.target.checked)} /> Autosave
        </label>
        <input value={autosaveInterval} onChange={(e) => setAutosaveInterval(Number(e.target.value) || 1000)} style={{ width: 80, padding: '6px 8px', borderRadius: 4 }} /> ms
        <button onClick={handleListVersions} style={{ padding: '6px 8px', borderRadius: 4 }}>🔢 Versions</button>
        <select value={selectedVersion || ''} onChange={(e) => setSelectedVersion(Number(e.target.value) || null)} style={{ padding: '6px 8px', borderRadius: 4 }}>
          <option value="">-- Versions --</option>
          {versions.map(v => (<option key={v.id} value={v.id}>{new Date(v.updatedAt).toLocaleString()}</option>))}
        </select>
        <button onClick={handleRestoreVersion} style={{ padding: '6px 8px', borderRadius: 4 }}>🔁 Restore</button>
        <button onClick={handleCompareVersion} style={{ padding: '6px 8px', borderRadius: 4 }}>🔍 Compare</button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <button onClick={async () => { setShowDiffPreview(s => !s); if (!showDiffPreview) { await handleListVersions(); } }} style={{ padding: '6px 8px', borderRadius: 4 }}>👁️ Preview Diff</button>
        {versionThumb && <img src={versionThumb} alt="version" style={{ width: 120, height: 70, objectFit: 'cover', border: '1px solid #ddd' }} />}
        {currentThumb && <img src={currentThumb} alt="current" style={{ width: 120, height: 70, objectFit: 'cover', border: '1px solid #ddd' }} />}
      </div>

      {showDiffPreview && (
        <div style={{ marginBottom: 8, padding: 8, border: '1px solid #eee', borderRadius: 4, maxHeight: 160, overflow: 'auto', background: '#fff' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Version Diff Preview</div>
          <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
            {/* compute and render a simple diff */}
            {/** We'll compute on render via async helper — show placeholder until available */}
            <DiffRenderer compute={computeDiffPreview} />
          </div>
        </div>
      )}

      <button
        onClick={handleCompile}
        style={{
          padding: '8px 12px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontWeight: 600,
          marginBottom: 8,
          fontSize: 12,
        }}
      >
        🔧 Compile Blocks
      </button>
      {compilationStatus && (
        <div
          style={{
            fontSize: 11,
            padding: 4,
            marginBottom: 8,
            background: '#f0f0f0',
            borderRadius: 4,
            color: '#333',
          }}
        >
          {compilationStatus}
        </div>
      )}
      <p style={{ fontSize: 11, color: '#666', margin: 0, marginBottom: 8 }}>
        Drag <strong>on start</strong> or <strong>on update</strong> blocks to define behavior.
      </p>
      <div ref={divRef} id="blocklyDiv" style={{ flex: 1, minHeight: 0, width: '100%', background: '#fff', border: '1px solid #ddd', borderRadius: 4, position: 'relative' }} />
      
      {compareOpen && (
        <ComparePanel
          leftXml={compareLeftXml}
          rightXml={compareRightXml}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  )
}
