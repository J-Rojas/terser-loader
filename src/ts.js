const typescript = require("ts-morph")

function createTypescriptProject(tsConfigFilePath) {
    if (project == null) {
        project = new typescript.Project({
            tsConfigFilePath
        })
    }
    return project
}

function markPropertyAsUnobfuscated(identifier, type, context) {
    //console.log("marking: ", identifier.getText(), identifier.getKindName(), type)
    //console.log("marking done")    
    if (context.toUnobfuscate.indexOf(identifier) == -1) {
        context.toUnobfuscate.push(identifier)
    }
    //identifier.rename(identifier.getText() + NOBF_MARKER)
}

function getMatchingTypes(node, context) {
    const type = node.getType()
    const symbol = type.getAliasSymbol()
    if (symbol && context.typeNames.has(symbol.getEscapedName())) {
        return symbol.getEscapedName()
    }    

    //console.log(type, null, 4)

    //let types = type.getTypes()
    //if (types) {
    //    types = types.map(it => getMatchingTypes(it)).filter(it => it)
    //    return types.length ? types : null
    //}
    return null
}

function processNode(child, traversal, context) {
    
    if (context.type) {
        
        //console.log("child kind when type is enabled ", child.getText())

        if (child.asKind(typescript.SyntaxKind.ObjectLiteralExpression)) {
            if (traversal) traversal.skip()
            // create a new nested context
            child.forEachChild((child, traversal) => processNode(child, traversal, Object.assign(context, { type: context.type })))            
        } else if (child.asKind(typescript.SyntaxKind.PropertyAssignment)) {            
            const children = child.getChildren()            
            const propName = children[0].getText()
            markPropertyAsUnobfuscated(children[0], context.type.getEscapedName(), context)

            // determine the type for this property assignment
            const typeDeclaration = context.type.getDeclarations()[0].getType().getProperty(propName).getDeclarations()[0].getType().getAliasSymbol()

            // create a new nested context
            let i = 0
            let contextNew = Object.assign(context, { type: typeDeclaration })
            child.forEachChild((child, traversal) => 
                i++ > 0 && processNode(child, traversal, contextNew)
            )
            if (traversal) traversal.skip()
        }
        context.type = null
    }

    //console.log(child.getKindName())
    if (child.asKind(typescript.SyntaxKind.PropertyAccessExpression)) {            
        // there are two children: first is the item that is being accessed, second is the property        
        const firstChild = child.getChildren()[0]
        const lastChild = child.getChildren()[2]                
        const type = getMatchingTypes(firstChild, context)
        if (type) {            
            markPropertyAsUnobfuscated(lastChild, type, context)
        }
                    
    } else if (child.asKind(typescript.SyntaxKind.CaretEqualsToken) || child.asKind(typescript.SyntaxKind.EqualsToken)) {
        // mark object property assignments        
        const sibling = child.getPreviousSibling()
        if (sibling) {            
            const symbol = sibling.getType().getSymbol() || sibling.getType().getAliasSymbol()
            if (symbol) {
                if (symbol && context.typeNames.has(symbol.getEscapedName())) {    
                    context.type = symbol                
                    //console.log("setting symbol: ", symbol && symbol.getEscapedName())
                }            
            }
        }
    }
    
}

function traverseNodes(sourceFile, context) {            
    sourceFile.forEachDescendant((child, traversal) => processNode(child, traversal, context))
}
 
function parseTypescript(project, file, options) {
    console.log("Processing ts")
    const sourceFile = project.getSourceFileOrThrow(file)
    
    // update identifiers
    //toUnobfuscate.forEach(it => it.rename(it.getText() + NOBF_MARKER))
    return sourceFile.getText()
}

module.exports = {
    traverseNodes,
    parseTypescript,
    createTypescriptProject
}