// Worker module for running sandboxed handler code

const pending = new Map<number, (res: any) => void>();

function callMain(name: string, args: any[]) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1e9) + Date.now();
    pending.set(id, resolve);
    // ask main thread to perform API call
    // @ts-ignore
    postMessage({ type: 'api', id, name, args });
  });
}

let handlers: Record<string, any> = {};

self.addEventListener('message', async (e: MessageEvent) => {
  const m = e.data || {};
  if (m && m.type === 'init') {
    handlers = m.handlers || {};
    // build callable functions from handler code
    for (const k of Object.keys(handlers)) {
      try {
        // eslint-disable-next-line no-new-func
        handlers[k] = (new Function('callMain', 'return async function(){ ' + handlers[k] + ' }'))(callMain);
      } catch (err) {
        handlers[k] = async () => { throw err; };
      }
    }
    // @ts-ignore
    postMessage({ type: 'ready' });
  } else if (m && m.type === 'run' && typeof handlers[m.name] === 'function') {
    try {
      const res = await handlers[m.name].apply(null, m.args || []);
      // @ts-ignore
      postMessage({ type: 'result', id: m.requestId, result: res });
    } catch (err) {
      // @ts-ignore
      postMessage({ type: 'error', id: m.requestId, error: String(err) });
    }
  } else if (m && m.type === 'apiResponse') {
    const cb = pending.get(m.id);
    if (cb) { cb(m.result); pending.delete(m.id); }
  }
});

export {}
