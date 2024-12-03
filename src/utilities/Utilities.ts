export function roundToDigits(val: number, digits = 3) {
	const multiplier = 10 ** digits

	return Math.round(val * multiplier) / multiplier
}

export function isNumber(value: any): value is number {
	return typeof value === 'number'
}

export function isString(value: any): value is string {
	return typeof value === 'string'
}

export function isBigInt(value: any): value is bigint {
	return typeof value === 'bigint'
}

export function isObject(value: any): value is object {
	return typeof value === 'object' && !Array.isArray(value)
}

export function isArray(value: any): value is any[] {
	return Array.isArray(value)
}

export function isBoolean(value: any): value is boolean {
	return typeof value === 'boolean'
}

export function isFunction(value: any): value is Function {
	return typeof value === 'function'
}
