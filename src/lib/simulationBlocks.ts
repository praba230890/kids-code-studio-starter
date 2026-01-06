/**
 * Custom simulation blocks for Blockly
 * These blocks provide kid-friendly access to the runtime API
 */

/**
 * Register custom simulation blocks on a Blockly instance
 */
export function registerSimulationBlocks(Blockly: any) {
  const setPropertyBlock = {
  type: 'sim_set_property',
  message0: 'set %1 property %2 to %3',
  args0: [
    {
      type: 'field_input',
      name: 'OBJECT',
      text: 'circle1',
    },
    {
      type: 'field_dropdown',
      name: 'PROPERTY',
      options: [
        ['x', 'x'],
        ['y', 'y'],
        ['color', 'color'],
        ['vx', 'vx'],
        ['vy', 'vy'],
        ['radius', 'radius'],
      ],
    },
    {
      type: 'input_value',
      name: 'VALUE',
      check: ['Number', 'String'],
    },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 230,
  tooltip: 'Set a property of an object',
  helpUrl: '',
  }

  const getPropertyBlock = {
  type: 'sim_get_property',
  message0: 'get %1 property %2',
  args0: [
    {
      type: 'field_input',
      name: 'OBJECT',
      text: 'circle1',
    },
    {
      type: 'field_dropdown',
      name: 'PROPERTY',
      options: [
        ['x', 'x'],
        ['y', 'y'],
        ['color', 'color'],
        ['vx', 'vx'],
        ['vy', 'vy'],
        ['radius', 'radius'],
      ],
    },
  ],
  output: ['Number', 'String'],
  colour: 230,
  tooltip: 'Get a property value from an object',
  helpUrl: '',
  }

  const logBlock = {
  type: 'sim_log',
  message0: 'log %1',
  args0: [
    {
      type: 'input_value',
      name: 'VALUE',
      check: ['String', 'Number'],
    },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 160,
  tooltip: 'Print a message to console',
  helpUrl: '',
  }

  const delayBlock = {
  type: 'sim_delay',
  message0: 'wait %1 seconds',
  args0: [
    {
      type: 'input_value',
      name: 'SECONDS',
      check: 'Number',
    },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 180,
  tooltip: 'Wait for a duration',
  helpUrl: '',
  }

  const onStartBlock = {
  type: 'sim_on_start',
  message0: 'on start %1',
  args0: [
    {
      type: 'input_statement',
      name: 'STATEMENTS',
    },
  ],
  colour: 45,
  tooltip: 'Code that runs when simulation starts',
  helpUrl: '',
}

/**
 * Block: On update event (runs every tick)
 */
  const onUpdateBlock = {
  type: 'sim_on_update',
  message0: 'on update %1',
  args0: [
    {
      type: 'input_statement',
      name: 'STATEMENTS',
    },
  ],
  colour: 45,
  tooltip: 'Code that runs every frame',
  helpUrl: '',
}

  const loadImageBlock = {
  type: 'sim_load_image',
  message0: 'load image %1',
  args0: [
    {
      type: 'field_input',
      name: 'ASSET_ID',
      text: 'asset-id',
    },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 290,
  tooltip: 'Load an image asset',
  helpUrl: '',
}

  const createSpriteBlock = {
  type: 'sim_create_sprite',
  message0: 'create sprite %1 at x %2 y %3 with image %4',
  args0: [
    {
      type: 'field_input',
      name: 'ID',
      text: 'sprite1',
    },
    {
      type: 'input_value',
      name: 'X',
      check: 'Number',
    },
    {
      type: 'input_value',
      name: 'Y',
      check: 'Number',
    },
    {
      type: 'field_input',
      name: 'IMAGE_ID',
      text: 'asset-id',
    },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 290,
  tooltip: 'Create a sprite from an image asset',
  helpUrl: '',
}

/**
 * Register all custom blocks
 */
  Blockly.Blocks['sim_set_property'] = {
    init() {
      this.jsonInit(setPropertyBlock)
    },
  }
  Blockly.Blocks['sim_get_property'] = {
    init() {
      this.jsonInit(getPropertyBlock)
    },
  }
  Blockly.Blocks['sim_log'] = {
    init() {
      this.jsonInit(logBlock)
    },
  }
  Blockly.Blocks['sim_delay'] = {
    init() {
      this.jsonInit(delayBlock)
    },
  }
  Blockly.Blocks['sim_on_start'] = {
    init() {
      this.jsonInit(onStartBlock)
    },
  }
  Blockly.Blocks['sim_on_update'] = {
    init() {
      this.jsonInit(onUpdateBlock)
    },
  }
  Blockly.Blocks['sim_load_image'] = {
    init() {
      this.jsonInit(loadImageBlock)
    },
  }
  Blockly.Blocks['sim_create_sprite'] = {
    init() {
      this.jsonInit(createSpriteBlock)
    },
  }

  // JavaScript generators for the custom blocks
  const js = (Blockly as any).JavaScript || (window as any).Blockly && (window as any).Blockly.JavaScript

  if (js) {
    // Support modern generator API (generator.forBlock) if available
    if ((js as any).forBlock && typeof (js as any).forBlock === 'object') {
      const forBlock = (js as any).forBlock as Record<string, Function>

      forBlock['sim_set_property'] = function (block: any, generator: any) {
        const obj = block.getFieldValue('OBJECT') || 'obj'
        const prop = block.getFieldValue('PROPERTY') || 'x'
        const value = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '0'
        return `setProperty("${obj}", "${prop}", ${value});\n`
      }

      forBlock['sim_get_property'] = function (block: any, generator: any) {
        const obj = block.getFieldValue('OBJECT') || 'obj'
        const prop = block.getFieldValue('PROPERTY') || 'x'
        return [ `getProperty("${obj}", "${prop}")`, generator.ORDER_ATOMIC ]
      }

      forBlock['sim_log'] = function (block: any, generator: any) {
        const value = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '""'
        return `console.log(${value});\n`
      }

      forBlock['sim_delay'] = function (block: any, generator: any) {
        const secs = generator.valueToCode(block, 'SECONDS', generator.ORDER_NONE) || '0'
        return `await new Promise(r => setTimeout(r, ${secs} * 1000));\n`
      }

      forBlock['sim_load_image'] = function (block: any, generator: any) {
        const assetId = block.getFieldValue('ASSET_ID') || ''
        return `loadImage("${assetId}");\n`
      }

      forBlock['sim_create_sprite'] = function (block: any, generator: any) {
        const id = block.getFieldValue('ID') || 'sprite1'
        const x = generator.valueToCode(block, 'X', generator.ORDER_NONE) || '0'
        const y = generator.valueToCode(block, 'Y', generator.ORDER_NONE) || '0'
        const imageId = block.getFieldValue('IMAGE_ID') || ''
        return `createSprite("${id}", ${x}, ${y}, "${imageId}");\n`
      }
    }

    // Legacy fallback: assign directly on Blockly.JavaScript if present
    try {
      js['sim_set_property'] = js['sim_set_property'] || function (block: any) {
        const obj = block.getFieldValue('OBJECT') || 'obj'
        const prop = block.getFieldValue('PROPERTY') || 'x'
        const value = (js as any).valueToCode(block, 'VALUE', (js as any).ORDER_NONE) || '0'
        return `setProperty("${obj}", "${prop}", ${value});\n`
      }

      js['sim_get_property'] = js['sim_get_property'] || function (block: any) {
        const obj = block.getFieldValue('OBJECT') || 'obj'
        const prop = block.getFieldValue('PROPERTY') || 'x'
        return [`getProperty("${obj}", "${prop}")`, (js as any).ORDER_ATOMIC]
      }

      js['sim_log'] = js['sim_log'] || function (block: any) {
        const value = (js as any).valueToCode(block, 'VALUE', (js as any).ORDER_NONE) || '""'
        return `console.log(${value});\n`
      }

      js['sim_delay'] = js['sim_delay'] || function (block: any) {
        const secs = (js as any).valueToCode(block, 'SECONDS', (js as any).ORDER_NONE) || '0'
        return `await new Promise(r => setTimeout(r, ${secs} * 1000));\n`
      }

      js['sim_load_image'] = js['sim_load_image'] || function (block: any) {
        const assetId = block.getFieldValue('ASSET_ID') || ''
        return `loadImage("${assetId}");\n`
      }

      js['sim_create_sprite'] = js['sim_create_sprite'] || function (block: any) {
        const id = block.getFieldValue('ID') || 'sprite1'
        const x = (js as any).valueToCode(block, 'X', (js as any).ORDER_NONE) || '0'
        const y = (js as any).valueToCode(block, 'Y', (js as any).ORDER_NONE) || '0'
        const imageId = block.getFieldValue('IMAGE_ID') || ''
        return `createSprite("${id}", ${x}, ${y}, "${imageId}");\n`
      }
    } catch (e) {
      // ignore errors during legacy registration
    }
  }
}
