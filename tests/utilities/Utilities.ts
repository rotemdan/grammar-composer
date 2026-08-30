import fs from 'fs'
import path from 'path'
import * as G from '../../src/exports/Exports.js'
import { stringifyParseTree } from '../../src/utilities/Utilities.js'

export function writeScratchpadOutputToDisk(parseTree: G.ParseTreeNode[], outFilename: string) {
	const scratchpadOutDir = 'tests/scratchpad/out/'

	fs.writeFileSync(
		path.join(scratchpadOutDir, `${outFilename}.json`),
		JSON.stringify(parseTree, undefined, 4)

	)
	
	fs.writeFileSync(
		path.join(scratchpadOutDir, `${outFilename}.parsetree`),
		stringifyParseTree(parseTree).trim()
	)
}
