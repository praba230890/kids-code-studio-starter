import React, { useEffect, useRef } from 'react'

interface ComparePanelProps {
  leftXml: string
  rightXml: string
  onClose: () => void
}

export default function ComparePanel({ leftXml, rightXml, onClose }: ComparePanelProps) {
  const leftRef = useRef<HTMLDivElement | null>(null)
  const rightRef = useRef<HTMLDivElement | null>(null)
  const leftWsRef = useRef<any>(null)
  const rightWsRef = useRef<any>(null)

  useEffect(() => {
    console.log('ComparePanel mounted with leftXml length:', leftXml.length, 'rightXml length:', rightXml.length)
    let disposed = false
    ;(async () => {
      try {
        // dynamic import to match existing loading strategy
        const BlocklyModule = (await import('blockly')) as any
        const Blockly = BlocklyModule.default ?? BlocklyModule

        // Load JavaScript generator
        const jsModule = await import('blockly/javascript')
        try {
          const maybeFactory = (jsModule as any).default || (jsModule as any)
          if (typeof maybeFactory === 'function') {
            maybeFactory(Blockly)
          }
        } catch (e) {
          console.warn('blockly/javascript factory call failed (non-fatal)', e)
        }

        // Register custom simulation blocks (CRITICAL for loading saved XML!)
        const blocksModule = await import('../lib/simulationBlocks')
        blocksModule.registerSimulationBlocks(Blockly)
        console.log('Custom blocks registered in ComparePanel')

        const injectOpts = {
          readOnly: true,
          trashcan: false,
          move: { scrollbars: true, drag: false },
          zoom: { controls: true, wheel: false },
          renderer: 'thrasos',
        }

        if (leftRef.current && !disposed) {
          console.log('Injecting left workspace...')
          leftWsRef.current = Blockly.inject(leftRef.current, injectOpts)
          try {
            if (leftXml) {
              let dom: any = null
              if (Blockly.Xml && typeof (Blockly.Xml as any).textToDom === 'function') {
                dom = (Blockly.Xml as any).textToDom(leftXml)
              } else {
                const parser = new DOMParser()
                const doc = parser.parseFromString(leftXml, 'text/xml')
                dom = doc.documentElement
              }
              if (dom) {
                console.log('Loading leftXml into workspace...')
                Blockly.Xml.domToWorkspace(dom, leftWsRef.current)
                console.log('Left workspace loaded')
              }
            } else {
              console.warn('leftXml is empty')
            }
          } catch (e) {
            console.warn('ComparePanel: failed parsing leftXml', e)
          }
        }

        if (rightRef.current && !disposed) {
          console.log('Injecting right workspace...')
          rightWsRef.current = Blockly.inject(rightRef.current, injectOpts)
          try {
            if (rightXml) {
              let dom: any = null
              if (Blockly.Xml && typeof (Blockly.Xml as any).textToDom === 'function') {
                dom = (Blockly.Xml as any).textToDom(rightXml)
              } else {
                const parser = new DOMParser()
                const doc = parser.parseFromString(rightXml, 'text/xml')
                dom = doc.documentElement
              }
              if (dom) {
                console.log('Loading rightXml into workspace...')
                Blockly.Xml.domToWorkspace(dom, rightWsRef.current)
                console.log('Right workspace loaded')
              }
            } else {
              console.warn('rightXml is empty')
            }
          } catch (e) {
            console.warn('ComparePanel: failed parsing rightXml', e)
          }
        }
      } catch (err) {
        console.error('ComparePanel: failed to load Blockly', err)
      }
    })()

    return () => {
      disposed = true
      try {
        leftWsRef.current?.dispose()
      } catch {}
      try {
        rightWsRef.current?.dispose()
      } catch {}
    }
  }, [leftXml, rightXml])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
    }}>
      <div style={{
        width: '90%',
        maxWidth: 1200,
        height: '80%',
        background: '#fff',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          padding: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #eee',
        }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Compare Workspaces</div>
          <button onClick={onClose} style={{
            background: '#2b7cff',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 4,
            cursor: 'pointer',
          }}>Close</button>
        </div>
        {!leftXml || !rightXml ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', flexDirection: 'column', padding: 20 }}>
            <p>Loading workspaces...</p>
            <p style={{ fontSize: 12, color: '#ccc' }}>Left: {leftXml.length} chars | Right: {rightXml.length} chars</p>
            {leftXml && (
              <details style={{ marginTop: 16, width: '100%', maxHeight: 200, overflow: 'auto' }}>
                <summary>Left XML</summary>
                <pre style={{ fontSize: 10, color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{leftXml.slice(0, 500)}</pre>
              </details>
            )}
            {rightXml && (
              <details style={{ marginTop: 8, width: '100%', maxHeight: 200, overflow: 'auto' }}>
                <summary>Right XML</summary>
                <pre style={{ fontSize: 10, color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{rightXml.slice(0, 500)}</pre>
              </details>
            )}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flex: 1,
            gap: 8,
            padding: 12,
            minHeight: 0,
          }}>
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #eee',
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '6px 10px',
                background: '#fafafa',
                borderBottom: '1px solid #eee',
                fontWeight: 600,
                fontSize: 12,
              }}>Current Workspace</div>
              <div ref={leftRef} style={{ flex: 1, minHeight: 0 }} />
            </div>
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #eee',
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '6px 10px',
                background: '#fafafa',
                borderBottom: '1px solid #eee',
                fontWeight: 600,
                fontSize: 12,
              }}>Selected Version</div>
              <div ref={rightRef} style={{ flex: 1, minHeight: 0 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
