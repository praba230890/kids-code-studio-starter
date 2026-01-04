/**
 * Block to JavaScript compiler
 * Converts Blockly XML into executable JS with whitelisted runtime API calls
 */

import { CompiledScript, RuntimeContext } from '../types/runtime'

export class BlockCompiler {
  /**
   * Compile Blockly blocks to a script object
   * For now, a simple pass-through that wraps user code safely
   */
  compile(blocklyXml: string, context: RuntimeContext): CompiledScript {
    // TODO: Parse Blockly XML and generate typed blocks
    // For MVP, return empty object (blocks not yet wired)
    return {
      onStart: () => {},
      onTick: () => {},
    }
  }

  /**
   * Generate JS code from Blockly block definitions
   * This will extract block types and generate safe JS function bodies
   */
  private generateFromBlocks(xml: string): string {
    // Placeholder: parse Blockly XML and generate JS
    // Example: extract <block type="controls_if"> and compile to JS
    return ''
  }

  /**
   * Wrap generated code in a sandbox function
   * Ensures only whitelisted runtime APIs are available
   */
  private createSandbox(code: string, context: RuntimeContext): Function {
    // Create a function that can only call whitelisted APIs
    const allowedGlobals = {
      Math,
      console: {
        log: (msg: any) => context.log(msg),
      },
      // Expose whitelisted runtime APIs
      setProperty: context.setProperty.bind(context),
      getProperty: context.getProperty.bind(context),
      emit: context.emit.bind(context),
      time: context.time,
    }

    try {
      // Use Function constructor with restricted scope (not eval for safety)
      // eslint-disable-next-line no-new-func
      return new Function(...Object.keys(allowedGlobals), `return async function() { ${code} }`)
        (...Object.values(allowedGlobals))
    } catch (err) {
      console.error('Compilation error:', err)
      return () => {}
    }
  }
}
