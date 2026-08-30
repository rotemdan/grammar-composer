import { type ParseTreeNode } from '../exports/Exports.js'

export function roundToDigits(val: number, digits = 3) {
	const multiplier = 10 ** digits

	return Math.round(val * multiplier) / multiplier
}

export function isNumber(value: unknown): value is number {
	return typeof value === 'number'
}

export function isString(value: unknown): value is string {
	return typeof value === 'string'
}

export function isBigInt(value: unknown): value is bigint {
	return typeof value === 'bigint'
}

export function isObject(value: unknown): value is object {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value)
}

export function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean'
}

export function isFunction(value: unknown): value is Function {
	return typeof value === 'function'
}

export function stringifyParseTree(parseTree: ParseTreeNode[], depth = 0): string {
	let result = ''

	const getNewlineWithIndent = (depth: number) => `\n${'\t'.repeat(depth)}`

	for (const node of parseTree) {
		result += `${getNewlineWithIndent(depth)}${node.name}`

		if (node.children && node.children.length > 0) {
			result += stringifyParseTree(node.children, depth + 1)
		} else {
			result += `${getNewlineWithIndent(depth + 1)}'${node.sourceText}'`
		}
	}

	return result
}
