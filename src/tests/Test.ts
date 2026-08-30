import { Timer } from '../utilities/Timer.js'
import { jsonSample1, jsonSample2 } from './test-data/TestData.js'
import { anyOf, buildGrammar } from '../exports/Exports.js'
import { JsonGrammar, jsonGrammarUnwrappedNonterminalNames } from './test-grammars/JsonGrammar.js'
import { XmlGrammar, xmlGrammarUnwrappedNonterminalNames } from './test-grammars/XmlGrammar.js'
import { RegExpGrammar, regExpGrammarUnwrappedNonterminalNames } from './test-grammars/RegExpGrammar.js'
import { writeFile } from 'fs/promises'
import { SimpleTestGrammar1 } from './test-grammars/SimpleTestGrammar1.js'

const log = console.log

function testBasic() {
	class MyGrammar {
		p1 = () => ['a', 'b', 'c', anyOf(this.p2, this.p3)]

		p2 = () => ['x', this.p4, 'z']

		p3 = () => ['x', this.p4, 'z', 'u']

		p4 = () => ['y']
	}

	const grammar = buildGrammar(MyGrammar, 'p1')

	const result = grammar.parse('abcxyzu')

	console.log(JSON.stringify(result, undefined, 4))
}

function testJsonParser() {
	const jsonString = jsonSample1

	const grammar = buildGrammar(JsonGrammar, 'expression', {
		unwrappedNonterminalNames: jsonGrammarUnwrappedNonterminalNames
	})

	const iterations = 1000

	let result1: any
	let result2: any

	const timer = new Timer()

	for (let i = 0; i < iterations; i++) {
		result1 = grammar.parse(jsonString)
	}
	timer.logAndRestart('grammar.Parse')

	for (let i = 0; i < iterations; i++) {
		result2 = JSON.parse(jsonString)
	}
	timer.logAndRestart('JSON.Parse')

	log(JSON.stringify(result1, undefined, 4))
}

async function testXmlParser() {
	const xmlString = `
<!DOCTYPE web-app>

<menu>
    <header>Adobe SVG Viewer</header>
    <item action="Open" id="Open">Open</item>
    <item action="OpenNew" id="OpenNew">Open New</item>
</menu>
`
	// Build the grammar. 'document' is the starting production
	const grammar = buildGrammar(XmlGrammar, 'document', {
		unwrappedNonterminalNames: xmlGrammarUnwrappedNonterminalNames
	})

	// Parse the XML string
	const parseTree = grammar.parse(xmlString)

	const parseTreeJson = JSON.stringify(parseTree, undefined, 4)

	log(parseTreeJson)

	await writeFile('out/out.json', parseTreeJson)
}

async function testRegExpParser() {
	//const regExpString = /^([+]?[1]?(1 )?[-.+]?\(?\d{1}[- .+]*\d{1}[- .+]*\d{1}\)?[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1})$/.source
	//const regExpString = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.source
	//const regExpString = /(?=.*[!@#$%^&*])^mongodb:\/\/(?<user>[a-zA-Z0-9]+):(?<pass>[a-zA-Z0-9!@#$%^&*]{8,})@(?<host>[a-z0-9.-]+):(?<port>\d{2,5})$/.source
	const regExpString = /^(abcd)*ef+g/.source
	//const regExpString = '(abcd)(aa))'

	const grammar = buildGrammar(RegExpGrammar, 'root', {
		unwrappedNonterminalNames: regExpGrammarUnwrappedNonterminalNames
	})

	const parseTree = grammar.parse(regExpString)

	const parseTreeJson = JSON.stringify(parseTree, undefined, 4)

	log(parseTreeJson)

	await writeFile('out/out.json', parseTreeJson)
}

function testParserError1() {
	const xmlData = `<hello> wo rld <!!! `

	const grammar = buildGrammar(XmlGrammar, 'document')

	const result = grammar.parse(xmlData)

	console.log(JSON.stringify(result, undefined, 4))
}

function testParserError2() {
	const jsonData = `{ "asdf": 12.5 `

	const grammar = buildGrammar(JsonGrammar, 'expression')

	const result = grammar.parse(jsonData)

	console.log(JSON.stringify(result, undefined, 4))
}

function test1() {
	const input = `abcdefg`

	const grammar = buildGrammar(SimpleTestGrammar1, 'root')

	const result = grammar.parse(input)

	console.log(JSON.stringify(result, undefined, 4))
}


//testParserError1()
//testParserError2()

//testJsonParser()
//testXmlParser()
testRegExpParser()

//test1()
