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
	return typeof value === 'object' && !Array.isArray(value)
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
