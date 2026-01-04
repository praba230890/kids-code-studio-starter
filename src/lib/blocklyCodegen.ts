/**
 * Blockly code generator for simulation blocks
 * Converts Blockly blocks into executable JavaScript
 */

// Note: Blockly instance and its JavaScript generator are provided at runtime
// to avoid module initialization ordering issues. The panel will pass the
// loaded Blockly instance into `extractEventHandlers` so generators are available.

/**
 * Extract event handlers from Blockly workspace
 * Returns { onStart, onTick, ... } with compiled JS code
 */
export function extractEventHandlers(workspace: any, jsGenerator?: any): Record<string, string> {
  const handlers: Record<string, string> = {}

  // Resolve JS generator from provided arg, workspace attachment, or global Blockly
  let jsGen: any = jsGenerator || (workspace && (workspace as any).__jsGen) || (workspace && (workspace as any).__blockly && (workspace as any).__blockly.JavaScript) || (window as any).Blockly && (window as any).Blockly.JavaScript

  // If jsGen is a module/factory function, try to call it with Blockly from the workspace
  if (jsGen && typeof jsGen === 'function') {
    try {
      const maybe = jsGen((workspace && (workspace as any).__blockly) || (window as any).Blockly)
      if (maybe && typeof maybe.statementToCode === 'function') jsGen = maybe
    } catch (e) {
      // ignore and continue; we'll try other fallbacks below
    }
  }

  if (!jsGen || typeof jsGen.statementToCode !== 'function') {
    console.error('Blockly.JavaScript generator not found. Make sure blockly/javascript is loaded and passed to extractEventHandlers.', {
      passed: jsGenerator,
      workspace__jsGen: workspace && (workspace as any).__jsGen,
      workspace_blockly_JS: workspace && (workspace as any).__blockly && (workspace as any).__blockly.JavaScript,
      globalBlocklyJS: (window as any).Blockly && (window as any).Blockly.JavaScript,
    })
    return handlers
  }

  const blocks = workspace.getAllBlocks(false)
  for (const block of blocks) {
    if (block.type === 'sim_on_start') {
      const statements = jsGen.statementToCode(block, 'STATEMENTS')
      handlers['onStart'] = statements || ''
    } else if (block.type === 'sim_on_update') {
      const statements = jsGen.statementToCode(block, 'STATEMENTS')
      handlers['onTick'] = statements || ''
    }
  }

  return handlers
}

/**
 * Convert handlers object into CompiledScript functions
 */
export function handlersToScript(
  handlers: Record<string, string>,
  context: any
): Record<string, Function> {
  const result: Record<string, Function> = {}

  const allowedGlobals = {
    Math,
    console: { log: (msg: any) => context.log(msg) },
    setProperty: context.setProperty.bind(context),
    getProperty: context.getProperty.bind(context),
    emit: context.emit.bind(context),
    time: context.time,
  }

  if (handlers.onStart) {
    try {
      // eslint-disable-next-line no-new-func
      result.onStart = new Function(...Object.keys(allowedGlobals), `return async function() { ${handlers.onStart} }`)
        (...Object.values(allowedGlobals))
    } catch (err) {
      console.error('Error compiling onStart:', err)
      result.onStart = () => {}
    }
  }

  if (handlers.onTick) {
    try {
      // eslint-disable-next-line no-new-func
      result.onTick = new Function(...Object.keys(allowedGlobals), `return async function() { ${handlers.onTick} }`)
        (...Object.values(allowedGlobals))
    } catch (err) {
      console.error('Error compiling onTick:', err)
      result.onTick = () => {}
    }
  }

  return result
}
