const Morph = require("ts-morph")
const { SyntaxKind } = require("ts-morph/dist/ts-morph")
const { traverseNodes } = require("./ts")
const { createWrappedNode, ts } = Morph
let program = null

function rewriteVisitor(node, context,  localContext) {        
    if (node.kind == SyntaxKind.Identifier && localContext.rewriteSet.has(node.pos)) {
        const nodeProperties = localContext.nodeProperties.get(node.pos)

        return context.factory.createIdentifier(node.getText() + 
            (nodeProperties.exclude ? localContext.excludeSuffix : "") +
            (nodeProperties.translation == "partial" ? localContext.translationPartialSuffix : "") +
            (nodeProperties.translation == "full" ? localContext.translationFullSuffix : "")
        )
        
    }
    return ts.visitEachChild(node, (child) => rewriteVisitor(child, context, localContext), context);
}

function addTypeToTypeMapOptions(typeMapOptions, types, option) {
    if (types) {
        for (let ty of types) {
            let opt = typeMapOptions.get(ty) || {}
            typeMapOptions.set(ty, Object.assign(opt, option))
        }
    }
}

function afterTransformer(context, options) {    
    return (node) => { 
                
        // wrap source files
        /*
        const wrappedNodes = {

        }
        program.getSourceFiles().forEach(it => {
            wrappedNodes[it.fileName] = createWrappedNode(it, { sourceFile: it, typeChecker: program.getTypeChecker(), createLanguageService: true })
        })
        */

        let toProcess = new Set()
        let nodeProperties = new Map()
        let typeMapOptions = new Map()

        // mangle types
        if (options.mangle) {
            if (options.mangle.exclude) {
                addTypeToTypeMapOptions(typeMapOptions, options.mangle.exclude.types, {
                    exclude: true
                })                
            }            
        }

        // translation types
        if (options.translation) {
            if (options.translation.full) {
                addTypeToTypeMapOptions(typeMapOptions, options.translation.full.types, {
                    translation: "full"
                })
            }
            if (options.translation.partial) {
                addTypeToTypeMapOptions(typeMapOptions, options.translation.partial.types, {
                    translation: "partial"
                })
            }            
        }

        const wrappedNode = createWrappedNode(node, { typeChecker: program.getTypeChecker(), createLanguageService: true })
        if (wrappedNode) {
            const localContext = Object.assign({}, {
                toProcess,
                nodeProperties,
                typeNames: typeMapOptions,
                translationFullSuffix: options.translationFullSuffix,
                translationPartialSuffix: options.translationPartialSuffix,
                excludeSuffix: options.excludeSuffix 
            })
            traverseNodes(wrappedNode, localContext)                    
                // update identifiers
            
        }

        const visitorContext = Object.assign({}, { 
            rewriteSet: toProcess, 
            nodeProperties,
            excludeSuffix: options.excludeSuffix,
            translationFullSuffix: options.translationFullSuffix,
            translationPartialSuffix: options.translationPartialSuffix,
        })        
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