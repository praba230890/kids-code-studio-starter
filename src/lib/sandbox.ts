// Simple sandbox runner using Web Worker and postMessage RPC

type Handlers = Record<string, string>

export class Sandbox {
  private worker: Worker | null = null
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timer?: number }>()
  private idCounter = 1
  private runTimeoutMs: number
  private initTimeoutMs: number

  constructor(opts?: { runTimeoutMs?: number; initTimeoutMs?: number }) {
    this.runTimeoutMs = opts?.runTimeoutMs ?? 2000 // default 2s per handler
    this.initTimeoutMs = opts?.initTimeoutMs ?? 3000 // default 3s to initialize
  }

  async init() {
    if (this.worker) return
    // spawn a module worker from a separate file so it's debuggable and avoids blob eval
    try {
      // Vite supports bundling worker modules referenced via `new URL(..., import.meta.url)`
      // @ts-ignore
      this.worker = new Worker(new URL('./sandboxWorker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e) => this.handleMessage(e.data)
    } catch (err) {
      // fallback to blob approach if module worker creation fails
      const blob = new Blob([
        `
        const pending = new Map();
        function callMain(name, args) {
          return new Promise((resolve) => {
            const id = Math.floor(Math.random()*1e9) + Date.now();
            pending.set(id, resolve);
            postMessage({ type: 'api', id, name, args });
          });
        }

        let handlers = {};

        onmessage = async (e) => {
          const m = e.data || {};
          if (m && m.type === 'init') {
            handlers = m.handlers || {};
            for (const k of Object.keys(handlers)) {
              try {
                // eslint-disable-next-line no-new-func
                handlers[k] = (new Function('callMain', 'return async function(){ ' + handlers[k] + ' }'))(callMain);
              } catch (err) {
                handlers[k] = async () => { throw err }
              }
            }
            postMessage({ type: 'ready' });
          } else if (m && m.type === 'run' && typeof handlers[m.name] === 'function') {
            try {
              const res = await handlers[m.name].apply(null, m.args || []);
              postMessage({ type: 'result', id: m.requestId, result: res });
            } catch (err) {
              postMessage({ type: 'error', id: m.requestId, error: String(err) });
            }
          } else if (m && m.type === 'apiResponse') {
            const cb = pending.get(m.id);
            if (cb) { cb(m.result); pending.delete(m.id); }
          }
        };
        `
      ], { type: 'application/javascript' })

      const url = URL.createObjectURL(blob)
      this.worker = new Worker(url, { type: 'module' })
      this.worker.onmessage = (e) => this.handleMessage(e.data)
    }
  }

  private handleMessage(msg: any) {
    if (!msg) return
    if (msg.type === 'api') {
      // Worker asking main to perform an API call; main should forward this
      // We don't handle here; main runtime wires its own handler when creating the sandbox.
      return
    }
    // other messages are handled by promises in run()
    const entry = this.pending.get(msg.id)
    if (!entry) return
    // clear timeout if present
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = undefined
    }
    if (msg.type === 'result') entry.resolve(msg.result)
    else if (msg.type === 'error') entry.reject(new Error(msg.error))
    this.pending.delete(msg.id)
  }

  async loadHandlers(handlers: Handlers, mainApiHandler: (name: string, args: any[]) => Promise<any>) {
    await this.init()
    if (!this.worker) throw new Error('worker not ready')

    // wire main message handling for 'api' messages coming from worker
    this.worker.onmessage = (e) => {
      const m = e.data || {}
      if (m && m.type === 'api') {
        // call mainApiHandler and post response back to worker
        mainApiHandler(m.name, m.args || []).then((res) => {
          this.worker && this.worker.postMessage({ type: 'apiResponse', id: m.id, result: res })
        }).catch((err) => {
          this.worker && this.worker.postMessage({ type: 'apiResponse', id: m.id, result: { error: String(err) } })
        })
        return
      }

      // other messages are handled by handleMessage
      this.handleMessage(m)
    }

    // send handlers to worker
    this.worker.postMessage({ type: 'init', handlers })
    // wait for ready with timeout
    await new Promise<void>((resolve, reject) => {
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        try { this.terminate() } catch (e) {}
        reject(new Error('Sandbox init timeout'))
      }, this.initTimeoutMs)

      const onmsg = (e: MessageEvent) => {
        if (timedOut) return
        const m = e.data || {}
        if (m && m.type === 'ready') {
          clearTimeout(timer)
          resolve()
          if (this.worker) this.worker.removeEventListener('message', onmsg)
        }
      }
      this.worker!.addEventListener('message', onmsg)
    })
  }

  async run(name: string, args?: any[]): Promise<any> {
    if (!this.worker) throw new Error('worker not ready')
    const reqId = this.idCounter++
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, timer: undefined as any }
      // start watchdog
      entry.timer = window.setTimeout(() => {
        // timeout: reject and terminate worker
        try { this.terminate() } catch (e) {}
        reject(new Error('Sandbox run timeout'))
        this.pending.delete(reqId)
      }, this.runTimeoutMs)

      this.pending.set(reqId, entry)
      this.worker!.postMessage({ type: 'run', name, args, requestId: reqId })
    })
  }

  terminate() {
    if (this.worker) {
      try { this.worker.terminate() } catch (e) {}
      this.worker = null
    }
    // reject any pending promises
    for (const [id, entry] of this.pending.entries()) {
      try { entry.reject(new Error('Sandbox terminated')) } catch (e) {}
      if (entry.timer) clearTimeout(entry.timer)
      this.pending.delete(id)
    }
  }
}

export default Sandbox
