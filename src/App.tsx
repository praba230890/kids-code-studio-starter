import React, { useRef, useState, useEffect } from 'react'
import Canvas from './components/Canvas'
import BlocklyPanel from './components/BlocklyPanel'
import AssetManager from './components/AssetManager'
import { SimulationRuntime } from './lib/simulationRuntime'
import { SimObject } from './types/runtime'

export default function App() {
  const runtimeRef = useRef<SimulationRuntime | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [rightWidth, setRightWidth] = useState<number>(520)
  const [activeTab, setActiveTab] = useState<'blocks' | 'assets'>('blocks')
  const draggingRef = useRef<boolean>(false)
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      // compute new width based on window and mouse X
      const rightRect = document.querySelector('.right') as HTMLElement | null
      const centerRect = document.querySelector('.center') as HTMLElement | null
      if (!rightRect || !centerRect) return
      const container = rightRect.parentElement as HTMLElement
      const containerRect = container.getBoundingClientRect()
      const newWidth = Math.max(220, containerRect.right - e.clientX - 8)
      setRightWidth(newWidth)
    }

    const onMouseUp = () => {
      draggingRef.current = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Initialize runtime on first render
  if (!runtimeRef.current) {
    runtimeRef.current = new SimulationRuntime()
    
    // Add some starter objects
    const circle: SimObject = {
      id: 'circle1',
      type: 'circle',
      x: 100,
      y: 50,
      radius: 24,
      color: '#0077ff',
      mass: 1,
      gravity: 1,
    }
    
    const rect: SimObject = {
      id: 'rect1',
      type: 'rect',
      x: 300,
      y: 100,
      width: 60,
      height: 60,
      color: '#ff0000',
      mass: 2,
    }
    
    runtimeRef.current.addObject(circle)
    runtimeRef.current.addObject(rect)
  }

  const handlePlay = () => {
    if (runtimeRef.current && !isRunning) {
      runtimeRef.current.start()
      setIsRunning(true)
    }
  }

  const handlePause = () => {
    if (runtimeRef.current && isRunning) {
      runtimeRef.current.stop()
      setIsRunning(false)
    }
  }

  const handleReset = () => {
    if (runtimeRef.current) {
      runtimeRef.current.reset()
      setIsRunning(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <span>Kids Studio — Starter</span>
        <div className="controls">
          <button onClick={handlePlay} disabled={isRunning}>▶ Play</button>
          <button onClick={handlePause} disabled={!isRunning}>⏸ Pause</button>
          <button onClick={handleReset}>↻ Reset</button>
          <span className="status">{isRunning ? 'Running' : 'Paused'}</span>
        </div>
      </header>
      <div className="main">
        <aside className="left">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Objects</div>
          <div style={{ fontSize: 12 }}>
            • Circle (circle1)<br/>
            • Rect (rect1)<br/>
          </div>
        </aside>
        <div className="center-right">
          <section className="center">
            <Canvas runtime={runtimeRef.current} />
          </section>

          <div
            className="splitter"
            onMouseDown={(e) => {
              draggingRef.current = true
              e.preventDefault()
            }}
          />

          <aside className="right" style={{ width: rightWidth, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #ddd', background: '#f8f9fa' }}>
              <button
                onClick={() => setActiveTab('blocks')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  background: activeTab === 'blocks' ? '#fff' : 'transparent',
                  borderBottom: activeTab === 'blocks' ? '2px solid #2b7cff' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'blocks' ? 600 : 400,
                  fontSize: 12,
                }}
              >
                🧩 Blocks
              </button>
              <button
                onClick={() => setActiveTab('assets')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  background: activeTab === 'assets' ? '#fff' : 'transparent',
                  borderBottom: activeTab === 'assets' ? '2px solid #2b7cff' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'assets' ? 600 : 400,
                  fontSize: 12,
                }}
              >
                📁 Assets
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <div style={{ display: activeTab === 'blocks' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <BlocklyPanel runtime={runtimeRef.current} />
              </div>
              <div style={{ display: activeTab === 'assets' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <AssetManager />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
