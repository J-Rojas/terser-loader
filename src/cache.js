const fs = require('fs');
const path = require('path');
const findUp = require('find-up')
const merge = require('merge')

function writePackageLockfile(packagesRoot) {
    const fpath = path.resolve(packagesRoot, "terser-loader.lock")
    if (fs.existsSync(fpath)) {
        throw new Error("Lock file exists!")
    }
    fs.mkdirSync(packagesRoot, { recursive: true })
    fs.writeFileSync(fpath, "")
}

function removePackageLockfile(packagesRoot) {
    const fpath = path.resolve(packagesRoot, "terser-loader.lock")
    fs.rmSync(fpath)
}

function readNameCache(packagesRoot, elements) {
    // read the cache properties file
    const filepath = path.resolve(packagesRoot, "NAME_CACHE.json")    
    if (fs.existsSync(filepath)) {        
        let newElements = getFileContents("NAME_CACHE.json", packagesRoot)

        for (let entry of Object.entries(newElements || {})) {
            elements[entry[0]] = merge(elements[entry[0]], entry[1])
        }        
    }
    return elements
}

function writeNameCache(packagesRoot, tableMap) {
    
    let elements = readNameCache(packagesRoot, {})

    //write table out
    for (let entry of tableMap.propsExt.entries()) {
        elements[entry[0]] = merge(elements[entry[0]], entry[1])
    }        
    writeFileContents("NAME_CACHE.json", packagesRoot, elements, true)
}

function writeTranslationTable(packagesRoot) {

    let elements = readNameCache(packagesRoot, {})

    const tableMap = new Map()
    for (let entry of Object.entries(elements || {})) {
        if (entry[1].translation) {
            tableMap.set(entry[0], entry[1].value)
        }
    }
    
    const fpath = path.resolve(packagesRoot, "TRANSLATION.js")
    let contents = "export default new Map(Object.entries({\n"

    for (let entry of tableMap.entries()) {
        contents += "    \"" + entry[0] + "\": \"" + entry[1] + "\",\n"
    }

    contents += "}))\n"

    fs.mkdirSync(packagesRoot, { recursive: true })
    fs.writeFileSync(fpath, contents)
}

function copyPackageFile(localPackagePath, packageRoot) {
    const dest = path.resolve(packageRoot, "package.json")
    if (!fs.existsSync(dest)) {
        fs.copyFileSync(
            path.resolve(localPackagePath, "package.json"), 
            path.resolve(packageRoot, "package.json")
        )    
    }
}

function updatePackageFileEntries(file, packageRoot) {    
    if (file.endsWith(".ts")) {
        const dest = path.resolve(packageRoot, "package.json")
        let contents = fs.readFileSync(dest)
        contents = contents.toString().replace(/.ts([\"'])/g, ".js$1")
        fs.writeFileSync(dest, contents)
    }    
}

function getLocalPackageFilePath(file, packagesRoot, root) {
    // check if the path is within node_modules
    let i = file.lastIndexOf("node_modules")
    if (i != -1) {
        return "./" + file.substring(i + "node_modules".length)
    }

    // check if the path is within the packagesRoot
    i = packagesRoot ? file.lastIndexOf(packagesRoot) : -1
    if (i != -1) {
        return "./" + file.substring(i + packagesRoot.length)
    }

    // else use the relative path
    return path.relative(root, file)
}

function getLocalPackagePath(file) {
    return path.dirname(findUp.sync('package.json', { cwd: path.dirname(file) }))
}

function getFileInfo(relativePath, root) {
    let filePath = path.resolve(root, relativePath)
    return fs.statSync(filePath, { throwIfNoEntry: false})
}

function getFileContents(relativePath, root) {
    let filePath = path.resolve(root, relativePath)
    return JSON.parse(fs.readFileSync(filePath))
}

function writeFileContents(relativePath, root, contents, stringify=false) {
    let filePath = path.resolve(root, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    return fs.writeFileSync(filePath, stringify ? JSON.stringify(contents, null, 4) : contents)
}

function getCachePaths(sourceFilename, cacheDir, packagesDir) {
    
    //LOG(sourceFilename, verbose);
    
    const localPackagePath = getLocalPackageFilePath(sourceFilename, packagesDir, this.context)
    let packagesPath = path.normalize(localPackagePath).replace(/.tsx?$/, ".js")
    if (!packagesPath.endsWith("js")) {
        packagesPath += ".js"
    }
    const packageRootPath = cacheDir ? path.resolve(cacheDir, packagesPath.substring(0, packagesPath.indexOf("/"))) : null
    const packagePath = getLocalPackagePath(sourceFilename)
    
    //LOG(packagesPath, true);
    //LOG(packagePath, true)
    return {
        localPackagePath,
        packageRootPath,
        packagesPath,
        packagePath
    }
}

function cacheKey(options, request) {
    //console.log("Cache")
    //console.log(JSON.stringify(options, 4))
    //console.log(JSON.stringify(request, 4))
    const idx = request.lastIndexOf("!")
    if (idx != -1) {
        return request.substring(idx + 1).replace(__dirname + "/", "")
    }
    return request
}

function compareCache(stats, dep) {
    //console.log("Compare", stats, dep)
    return true
}

function writeCache(sourceFilename, data, callback) {
    
    let content = callback ? data.result[0].toString() : data.code

    var opts = this.query;
    var cacheDir = opts && opts.cacheDir || process.env.CACHE_DIR
    var packagesDir = opts && opts.packagesDir || process.env.PACKAGES_DIR
    
    const { packagesPath } = getCachePaths(sourceFilename, cacheDir, packagesDir)
        
    if (cacheDir) {

        //console.log(content)

        // save to cache
        writeFileContents(packagesPath + ".json", cacheDir, data, true)
        writeFileContents(packagesPath, cacheDir, content)
    }

    if (callback)
        callback()
}

function readCache(sourceFilename, callback) {
    
    var opts = this.query;
    var cacheDir = opts && opts.cacheDir || process.env.CACHE_DIR
    var packagesDir = opts && opts.packagesDir || process.env.PACKAGES_DIR
    
    const { packagesPath } = getCachePaths(sourceFilename, cacheDir, packagesDir)

    let result = null
    let start = sourceFilename.lastIndexOf("!")
    let sourceFilePath = start != -1 ? sourceFilename.substring(start + 1) : sourceFilename

    //console.log("Read cache: ", sourceFilePath)

    // inspect the cache for an existing entry that is not stale
    if (cacheDir) {

        // create cache if it doesn't exist
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true })
        }

        let cacheInfo = getFileInfo(packagesPath + ".json", cacheDir)
        let fileInfo = getFileInfo(sourceFilePath, "")

        //console.log("Cacheinfo", cacheInfo)
        //console.log("Fileinfo", fileInfo)

        if ((cacheInfo && cacheInfo.mtime) > (fileInfo && fileInfo.mtime)) {
            // use the cache entry
            result = getFileContents(packagesPath + ".json", cacheDir)
        }
    }

    //console.log(result)

    if (callback) {
        if (result) {            
            //console.log("read cache: success")

            callback(null, result)
            
        } else {
            return callback(new Error())
        }           
    } else {
        return result
    }   

    
}

module.exports = {
    readCache,
    writeCache,
    writePackageLockfile,
    removePackageLockfile,
    readNameCache,
    writeNameCache,
    writeTranslationTable,
    copyPackageFile,
    updatePackageFileEntries,
    getLocalPackageFilePath,
    getLocalPackagePath,
    getFileInfo,
    getFileContents,
    writeFileContents,
    getCachePaths,
    cacheKey,
    compareCache
}