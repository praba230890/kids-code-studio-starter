import React, { useRef, useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { SimulationRuntime } from '../lib/simulationRuntime'
import { SimObject } from '../types/runtime'

interface CanvasProps {
  runtime: SimulationRuntime | null
}

export default function Canvas({ runtime }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const displayObjectsRef = useRef<Map<string, PIXI.DisplayObject>>(new Map())
  const [, setRenderTrigger] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return

    const app = new PIXI.Application({
      backgroundColor: 0xf0f0f0,
      width: 600,
      height: 400,
      resolution: window.devicePixelRatio || 1,
    })

    containerRef.current.appendChild(app.view as any)
    appRef.current = app

    // Main render loop: sync display objects with runtime state
    app.ticker.add(() => {
      if (!runtime) return
      const context = runtime.getContext()
      
      // Update or create display objects based on runtime objects
      for (const [id, obj] of context.objects) {
        let displayObj = displayObjectsRef.current.get(id)
        
        if (!displayObj) {
          const newObj = createDisplayObject(obj, runtime)
          if (newObj) {
            displayObj = newObj
            app.stage.addChild(displayObj)
            displayObjectsRef.current.set(id, displayObj)
          }
        }
        
        if (displayObj) {
          displayObj.x = obj.x
          displayObj.y = obj.y
        }
      }

      // Remove objects that no longer exist
      for (const [id, displayObj] of displayObjectsRef.current) {
        if (!context.objects.has(id)) {
          app.stage.removeChild(displayObj)
          displayObjectsRef.current.delete(id)
        }
      }
    })

    return () => {
      app.destroy(true, { children: true })
      appRef.current = null
      displayObjectsRef.current.clear()
    }
  }, [runtime])

  return (
    <div ref={containerRef} style={{ width: 600, height: 400, border: '1px solid #ddd' }} />
  )
}

/**
 * Create a PIXI display object from a SimObject
 */
function createDisplayObject(obj: SimObject, runtime: SimulationRuntime): PIXI.DisplayObject | null {
  switch (obj.type) {
    case 'circle': {
      const g = new PIXI.Graphics()
      g.beginFill(obj.color ? parseInt(obj.color.replace('#', ''), 16) : 0x0077ff)
      g.drawCircle(0, 0, obj.radius || 20)
      g.endFill()
      return g
    }
    case 'rect': {
      const g = new PIXI.Graphics()
      g.beginFill(obj.color ? parseInt(obj.color.replace('#', ''), 16) : 0xff0000)
      g.drawRect(0, 0, obj.width || 50, obj.height || 50)
      g.endFill()
      return g
    }
    case 'sprite': {
      if (!obj.imageId) return null
      const img = runtime.getLoadedImage(obj.imageId)
      if (!img) return null
      
      const texture = PIXI.Texture.from(img)
      const sprite = new PIXI.Sprite(texture)
      sprite.width = obj.width || img.width
      sprite.height = obj.height || img.height
      return sprite
    }
    case 'text': {
      const text = new PIXI.Text(obj.text || 'Text', { fill: 0x000000 })
      return text
    }
    default:
      return null
  }
}
