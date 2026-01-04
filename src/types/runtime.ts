/**
 * Core types and interfaces for the simulation runtime
 */

export interface SimObject {
  id: string
  type: 'circle' | 'rect' | 'image' | 'text'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  color?: string
  opacity?: number
  mass?: number
  vx?: number
  vy?: number
  gravity?: number
  text?: string
  [key: string]: any
}

export interface RuntimeContext {
  objects: Map<string, SimObject>
  time: number
  deltaTime: number
  events: Map<string, Function[]>
  variables: Map<string, any>
  emit: (event: string, ...args: any[]) => void
  setProperty: (objectId: string, prop: string, value: any) => void
  getProperty: (objectId: string, prop: string) => any
  log: (message: any) => void
  addObject: (obj: SimObject) => void
  removeObject: (objectId: string) => void
}

export interface CompiledScript {
  onStart?: () => void
  onTick?: (deltaTime: number) => void
  onClick?: (objectId: string) => void
  onCollision?: (obj1Id: string, obj2Id: string) => void
}
