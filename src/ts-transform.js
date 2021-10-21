const Morph = require("ts-morph")
const { SyntaxKind } = require("ts-morph/dist/ts-morph")
const { traverseNodes } = require("./ts")
const { createWrappedNode, ts } = Morph
let program = null

function rewriteVisitor(node, context,  localContext) {    
    if (localContext.rewriteSet.has(node.pos)) {
        return context.factory.createIdentifier(node.getText() + localContext.excludeSuffix)
    }
    return ts.visitEachChild(node, (child) => rewriteVisitor(child, context, localContext), context);
}

function afterTransformer(context, options) {    
    return (node) => { 
        
        console.log("Filename: " + node.fileName)

        // wrap source files
        const wrappedNodes = {

        }
        program.getSourceFiles().forEach(it => {
            wrappedNodes[it.fileName] = createWrappedNode(it, { sourceFile: it, typeChecker: program.getTypeChecker(), createLanguageService: true })
        })

        let toUnobfuscate = []
        const wrappedNode = wrappedNodes[node.fileName]
        const localContext = Object.assign({}, {
            toUnobfuscate,
            typeNames: new Set(options.typeNames),
            excludeSuffix: options.excludeSuffix 
        })
        try {            
            traverseNodes(wrappedNode, localContext)                        
            // update identifiers
        } catch (e) {
            throw e
        }

        const rewriteSet = new Set()
        const visitorContext = Object.assign({}, { rewriteSet, excludeSuffix: options.excludeSuffix })
        toUnobfuscate.forEach(it => rewriteSet.add(it.compilerNode.pos))
        return ts.visitNode(node, (child) => rewriteVisitor(child, context, visitorContext))
    }
}

function parseTypescript(programLocal, options) {        
    program = programLocal
    program.getTypeChecker() 

    console.log("Processing ts-loader transformer: ")
    return {
        after: [(context) => afterTransformer(context, options)]
    }
}

module.exports = parseTypescript