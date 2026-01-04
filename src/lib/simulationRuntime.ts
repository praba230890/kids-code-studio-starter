/**
 * Simulation Runtime Engine
 * Manages object state, event dispatch, and user code execution
 */

import { SimObject, RuntimeContext, CompiledScript } from '../types/runtime'
import Sandbox from './sandbox'

export class SimulationRuntime {
  private context: RuntimeContext
  private script: CompiledScript
  private sandbox: Sandbox | null = null
  private running: boolean = false
  private lastTime: number = 0
  private animationFrameId: number | null = null

  constructor() {
    this.context = {
      objects: new Map(),
      time: 0,
      deltaTime: 0,
      events: new Map(),
      variables: new Map(),
      emit: this.emit.bind(this),
      setProperty: this.setProperty.bind(this),
      getProperty: this.getProperty.bind(this),
      log: this.log.bind(this),
      addObject: this.addObject.bind(this),
      removeObject: this.removeObject.bind(this),
    }
    this.script = {} as CompiledScript
  }

  /**
   * Load a compiled script into the runtime
   */
  loadScript(script: CompiledScript | Record<string, Function>) {
    // Handle both CompiledScript interface and Record<string, Function>
    if (typeof script.onStart === 'function') {
      this.script.onStart = script.onStart
    }
    if (typeof script.onTick === 'function') {
      this.script.onTick = script.onTick
    }
    if (typeof script.onClick === 'function') {
      this.script.onClick = script.onClick
    }
    if (typeof script.onCollision === 'function') {
      this.script.onCollision = script.onCollision
    }
  }

  /**
   * Load handlers (code strings) into sandboxed worker
   */
  async loadScriptInSandbox(handlers: Record<string, string>) {
    if (!this.sandbox) this.sandbox = new Sandbox()

    const mainApiHandler = async (name: string, args: any[]) => {
      // map API names from sandbox to runtime functions
      try {
        if (name === 'setProperty') {
          this.setProperty(args[0], args[1], args[2])
          return true
        }
        if (name === 'getProperty') {
          return this.getProperty(args[0], args[1])
        }
        if (name === 'emit') {
          this.emit(args[0], ...(args[1] || []))
          return true
        }
        if (name === 'log') {
          this.log(args[0])
          return true
        }
        return null
      } catch (err) {
        return { error: String(err) }
      }
    }

    await this.sandbox.loadHandlers(handlers, mainApiHandler)
  }

  /**
   * Start the simulation loop
   */
  start() {
    this.running = true
    this.lastTime = performance.now()
    this.context.time = 0

    // Call onStart hook (both in-process and sandboxed if available)
    if (this.script.onStart) {
      try {
        this.script.onStart()
      } catch (err) {
        console.error('onStart error:', err)
      }
    }

    if (this.sandbox) {
      try {
        this.sandbox.run('onStart').catch((err) => console.error('sandbox onStart error:', err))
      } catch (err) {
        console.error('sandbox onStart error:', err)
      }
    }

    this.tick()
  }

  /**
   * Stop the simulation
   */
  stop() {
    this.running = false
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Main simulation tick
   */
  private tick = () => {
    if (!this.running) return

    const now = performance.now()
    const deltaTime = (now - this.lastTime) / 1000 // Convert to seconds
    this.lastTime = now
    this.context.deltaTime = deltaTime
    this.context.time += deltaTime

    // Update physics (simple)
    this.updatePhysics(deltaTime)

    // Call onTick hook (both in-process and sandboxed)
    if (this.script.onTick) {
      try {
        this.script.onTick(deltaTime)
      } catch (err) {
        console.error('onTick error:', err)
      }
    }

    if (this.sandbox) {
      try {
        this.sandbox.run('onTick', [deltaTime]).catch((err) => console.error('sandbox onTick error:', err))
      } catch (err) {
        console.error('sandbox onTick error:', err)
      }
    }

    this.animationFrameId = requestAnimationFrame(this.tick)
  }

  /**
   * Simple physics update: gravity and velocity
   */
  private updatePhysics(deltaTime: number) {
    const GRAVITY = 9.8
    for (const obj of this.context.objects.values()) {
      if (obj.gravity !== false && obj.mass !== undefined) {
        obj.vy = (obj.vy || 0) + GRAVITY * deltaTime
        obj.y += obj.vy * deltaTime
      }
      obj.x += (obj.vx || 0) * deltaTime
    }
  }

  /**
   * Whitelisted API: set object property
   */
  setProperty(objectId: string, prop: string, value: any) {
    const obj = this.context.objects.get(objectId)
    if (obj) {
      obj[prop] = value
    }
  }

  /**
   * Whitelisted API: get object property
   */
  getProperty(objectId: string, prop: string) {
    const obj = this.context.objects.get(objectId)
    return obj ? obj[prop] : undefined
  }

  /**
   * Whitelisted API: emit event
   */
  emit(event: string, ...args: any[]) {
    const handlers = this.context.events.get(event) || []
    handlers.forEach(h => {
      try {
        h(...args)
      } catch (err) {
        console.error(`Event handler error for '${event}':`, err)
      }
    })
  }

  /**
   * Whitelisted API: log to console
   */
  log(message: any) {
    console.log('[SIM]', message)
  }

  /**
   * Add an object to the scene
   */
  addObject(obj: SimObject) {
    this.context.objects.set(obj.id, obj)
  }

  /**
   * Remove an object from the scene
   */
  removeObject(objectId: string) {
    this.context.objects.delete(objectId)
  }

  /**
   * Get current context (for rendering, etc.)
   */
  getContext(): RuntimeContext {
    return this.context
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.stop()
    this.context.time = 0
    this.context.variables.clear()
    // Don't clear objects; just reset their physics
    for (const obj of this.context.objects.values()) {
      obj.vx = 0
      obj.vy = 0
    }
  }
}
