import { PatternExpression } from 'regexp-composer'
import { isArray, isBoolean, isString } from '../utilities/Utilities.js'
import { GrammarNode } from './Grammar.js'

/////////////////////////////////////////////////////////////////////////////////////////////////
// Internal static analysis methods
/////////////////////////////////////////////////////////////////////////////////////////////////
export function detectAndAnnotateOptionalNodes(rootNode: GrammarNode) {
	const visitedNodes = new Set<GrammarNode>()

	const resolvedNodes = new Map<GrammarNode, boolean>()
	const unresolvedNodes = new Map<GrammarNode, { dependencies: Set<GrammarNode>, isChoice: boolean }>()

	function processDepthFirst(node: GrammarNode): boolean | undefined {
		if (visitedNodes.has(node)) {
			return resolvedNodes.get(node)
		}

		visitedNodes.add(node)

		switch (node.type) {
			case 'StringTerminal':
			case 'PatternTerminal': {
				resolvedNodes.set(node, node.optional)

				return node.optional
			}

			case 'Nonterminal':
			case 'Repetition': {
				const result = processDepthFirst(node.content)

				if (node.optional) {
					resolvedNodes.set(node, true)

					return true
				} else if (isBoolean(result)) {
					resolvedNodes.set(node, result)

					return result
				} else {
					unresolvedNodes.set(node, { dependencies: new Set([node.content]), isChoice: false })

					return undefined
				}
			}

			case 'Sequence': {
				const dependencies = new Set<GrammarNode>()

				let hasNonOptionalResolvedMember = false

				for (const member of node.members) {
					const result = processDepthFirst(member)

					if (isBoolean(result)) {
						if (result === false) {
							hasNonOptionalResolvedMember = true
						}
					} else {
						dependencies.add(member)
					}
				}

				if (node.optional === true) {
					resolvedNodes.set(node, true)

					return true
				} else if (hasNonOptionalResolvedMember) {
					resolvedNodes.set(node, false)

					return false
				} else if (dependencies.size === 0) {
					resolvedNodes.set(node, true)

					return true
				} else {
					unresolvedNodes.set(node, { dependencies, isChoice: false })

					return undefined
				}
			}

			case 'Choice': {
				const dependencies = new Set<GrammarNode>()
				let hasOptionalResolvedMember = false

				for (const member of node.members) {
					const result = processDepthFirst(member)

					if (isBoolean(result)) {
						if (result === true) {
							hasOptionalResolvedMember = true
						}
					} else {
						dependencies.add(member)
					}
				}

				if (node.optional === true) {
					resolvedNodes.set(node, true)

					return true
				} else if (hasOptionalResolvedMember) {
					resolvedNodes.set(node, true)

					return true
				} else if (dependencies.size === 0) {
					resolvedNodes.set(node, false)

					return false
				} else {
					unresolvedNodes.set(node, { dependencies, isChoice: true })

					return undefined
				}
			}
		}

		return undefined
	}

	// Process depth first to resolve the easy cases, for productions that contain
	// no cyclic references:
	processDepthFirst(rootNode)

	// Now the remainder consists of nodes containing cyclic references that have not yet been resolved.
	// Use a form of iterative elimination and substitution to resolve them:
	while (unresolvedNodes.size > 0) {
		// This variable tracks whether at least one dependency was resolved, in any node.
		// If it stays false, it means that no improvement was made during the iteration,
		// and we should exit the loop.
		let atLastOneDependencyResolvedInAnyNode = false

		const nodesToDelete: GrammarNode[] = []

		// Scan the unresolved nodes to locate any new resolved dependencies
		for (const [node, { dependencies, isChoice }] of unresolvedNodes) {
			let nodeResolved = false

			// Iterate over all unresolved dependencies for the node
			for (const dependency of Array.from(dependencies)) {
				// Check if the dependency has been resolved
				const value = resolvedNodes.get(dependency)

				if (value !== undefined) {
					// If it did, record that some dependencies were resolved
					atLastOneDependencyResolvedInAnyNode = true

					if (isChoice) {
						if (value === true) {
							resolvedNodes.set(node, true)
							nodeResolved = true

							break
						}
					} else {
						if (value === false) {
							resolvedNodes.set(node, false)
							nodeResolved = true

							break
						}
					}

					dependencies.delete(dependency)
				}
			}

			if (nodeResolved) {
				nodesToDelete.push(node)
			} else if (dependencies.size === 0) {
				if (isChoice) {
					resolvedNodes.set(node, false)
				} else {
					resolvedNodes.set(node, true)
				}

				nodesToDelete.push(node)
			}
		}

		for (const node of nodesToDelete) {
			unresolvedNodes.delete(node)
		}

		// If not even one dependency was eliminated for any node,
		// it means that only mutually cyclic nodes are left unresolved, so exit the loop.
		if (!atLastOneDependencyResolvedInAnyNode) {
			break
		}
	}

	// All remaining unresolved nodes are part of a strongly-connected cyclic
	// component with no resolvable nullable base case. The least fixed-point
	// for nullability is `false` (not optional): a cycle without an empty
	// alternative cannot derive the empty string.
	for (const node of unresolvedNodes.keys()) {
		resolvedNodes.set(node, false)
		unresolvedNodes.delete(node)
	}

	// Finally set the 'optional' property of all nodes based on the detected values.
	for (const [node, isOptional] of resolvedNodes) {
		node.optional = isOptional
	}
}

export function detectAndErrorOnLeftRecursion(rootNode: GrammarNode) {
	const currentlyIteratedNodes = new Set<GrammarNode>()

	function detect(node: GrammarNode) {
		if (currentlyIteratedNodes.has(node)) {
			if (node.type === 'Nonterminal') {
				throw new Error(`Detected left recursion for nonterminal '${node.name}'.`)
			} else {
				try {
					throw new Error(`Detected left recursion for node: ${JSON.stringify(node, undefined, 4)}`)
				} catch {
					throw new Error(`Detected left recursion for node type '${(node as any).type}'.`)
				}
			}
		}

		currentlyIteratedNodes.add(node)

		switch (node.type) {
			case 'Nonterminal':
			case 'Repetition': {
				detect(node.content)

				break
			}

			case 'Sequence': {
				for (const member of node.members) {
					detect(member)

					if (!member.optional) {
						break
					}
				}

				break
			}

			case 'Choice': {
				for (const member of node.members) {
					detect(member)
				}

				break
			}
		}

		currentlyIteratedNodes.delete(node)
	}

	detect(rootNode)
}

// Walks the regexp-composer Pattern AST to validate its capture groups.
//
// The JavaScript RegExp engine collapses multiple named groups that share a name
// into a single entry, and cannot reliably report the ordering of a mix of named
// and unnamed groups. Both cases are problematic for the parser, so we detect them
// here, once, at grammar build time (before the RegExp is even compiled), instead of
// during parsing.
//
// Mirrors the AST traversal performed by regexp-composer's own 'isPatternOptional'.
export function validatePatternCaptureGroups(patternExpression: PatternExpression): void {
	const seenNamedCaptureGroupNames = new Set<string>()
	let hasNamedCaptureGroup = false
	let hasUnnamedCaptureGroup = false

	function walk(node: PatternExpression): void {
		if (isString(node)) {
			return
		}

		if (isArray(node)) {
			for (const element of node) {
				walk(element)
			}

			return
		}

		switch (node.type) {
			case 'capture': {
				if (node.name !== undefined) {
					if (seenNamedCaptureGroupNames.has(node.name)) {
						throw new Error(`The regular expression pattern contains multiple named capture groups with the same name '${(node as any).name}'. Named capture groups must have unique names.`)
					}

					seenNamedCaptureGroupNames.add(node.name)
					hasNamedCaptureGroup = true
				} else {
					hasUnnamedCaptureGroup = true
				}

				walk(node.content)

				return
			}

			// Composite nodes that wrap content without creating a capturing group.
			// regexp-composer uses a `greedy` boolean to distinguish `zeroOrMore` vs
			// `zeroOrMoreNonGreedy` etc, but both share the same `type` string
			// (`zeroOrMore`, `oneOrMore`, `repeated`). Handle any type that wraps
			// a single `content` field.
			case 'possibly':
			case 'zeroOrMore':
			case 'oneOrMore':
			case 'repeated':
			case 'followedBy':
			case 'notFollowedBy':
			case 'precededBy':
			case 'notPrecededBy': {
				walk(node.content)

				return
			}

			case 'anyOf': {
				for (const member of node.members) {
					walk(member)
				}

				return
			}

			// These nodes never introduce capturing groups and contain only
			// character-level tokens or backreferences:
			case 'notAnyOfChars':
			case 'specialToken':
			case 'sameAs': {
				return
			}

			default: {
				throw new Error(`Unrecognized pattern type: ${(node as any).type}`)
			}
		}
	}

	walk(patternExpression)

	if (hasNamedCaptureGroup && hasUnnamedCaptureGroup) {
		throw new Error(`The regular expression pattern contains a combination of named and unnamed capture groups. Due to limitations of the JavaScript RegExp engine, it is impossible to reliably identify the ordering of this combination, please use either all unnamed or all named capture groups, but not both.`)
	}
}
