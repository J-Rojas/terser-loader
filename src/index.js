const Terser = require('terser');
const loaderUtils = require('loader-utils');
const sourceMap = require('source-map');
const extend = require('extend');
const getLogger = require('webpack-log');
const path = require('path')
const fs = require('fs');
const ts = require('./ts')
const log = getLogger({ name: 'terser-loader' });

async function mergeSourceMap(map, inputMap) {
  var inputMapConsumer = await new sourceMap.SourceMapConsumer(inputMap);
  var outputMapConsumer = await new sourceMap.SourceMapConsumer(map);

  var mergedGenerator = new sourceMap.SourceMapGenerator({
    file: inputMapConsumer.file,
    sourceRoot: inputMapConsumer.sourceRoot
  });

  var source = map.sources[0];

  inputMapConsumer.eachMapping(function (mapping) {
    var generatedPosition = outputMapConsumer.generatedPositionFor({
      line: mapping.generatedLine,
      column: mapping.generatedColumn,
      source: source
    });
    if (generatedPosition.column != null) {
      mergedGenerator.addMapping({
        source: mapping.source,

        original: mapping.source == null ? null : {
          line: mapping.originalLine,
          column: mapping.originalColumn
        },

        generated: generatedPosition
      });
    }
  });

  var mergedMap = mergedGenerator.toJSON();
  inputMap.mappings = mergedMap.mappings;

  return inputMap
};

function LOG(msg, verbose) {
  if (verbose) log.info(msg);
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

function getFileInfo(relativePath, root) {
    let filePath = path.resolve(root, relativePath)
    return fs.statSync(filePath, { throwIfNoEntry: false})
}

function getFileContents(relativePath, root) {
    let filePath = path.resolve(root, relativePath)
    return JSON.parse(fs.readFileSync(filePath))
}

function writeFileContents(relativePath, root, contents) {
    let filePath = path.resolve(root, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    return fs.writeFileSync(filePath, JSON.stringify(contents))
}

module.exports = function(source, inputSourceMap) {
    var callback = this.async();

    if (this.cacheable) {
      this.cacheable(); 
    }

    var sourceFilename = inputSourceMap ? inputSourceMap.sources[0] : this.resourcePath;

    var opts = this.query;
    var rules = opts.rules || [];    
    var cacheDir = opts.cacheDir
    var packagesDir = opts.packagesDir
    var terserDefaultOpts = opts.default;
    var terserOpts = terserDefaultOpts;
    var verbose = opts.verbose

    //LOG(sourceFilename, true);

    const packagesPath = path.normalize(getLocalPackageFilePath(sourceFilename, packagesDir, this.context))

    //LOG(packagesPath, true);
    
    // apply options based on rules
    var overridden = false;
    
    var matchedRules = rules.filter(it => {
        if (it.test) {
            if (Array.isArray(it.test)) {
                return it.test.filter(it => new RegExp(it).test(sourceFilename)).length > 0;                    
            }
            return new RegExp(it.test).test(sourceFilename)
        }
        return false
    });
    if (matchedRules.length > 0) {
        overridden = true;
        // do not deep copy the name cache
        var nameCache = terserOpts.nameCache;
        var origOpts = terserOpts;
        terserOpts.nameCache = null;

        //clone and extend
        LOG("Overridden rule: " + matchedRules[0].test, verbose);  
        
        terserOpts = extend(true, {}, terserOpts, matchedRules[0].options); 
                
        // use the original object reference for the nameCache
        terserOpts.nameCache = origOpts.nameCache = nameCache;        
    }

    
    terserOpts.sourceMap = {
        filename: sourceFilename,
        url: sourceFilename + ".map"      
    };

    var result = null;
    try {                

        let start = sourceFilename.lastIndexOf("!")
        let sourceFilePath = start != -1 ? sourceFilename.substring(start + 1) : sourceFilename

        // inspect the cache for an existing entry that is not stale
        if (cacheDir) {

            // create cache if it doesn't exist
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true })
            }

            let cacheInfo = getFileInfo(packagesPath + ".json", cacheDir)
            let fileInfo = getFileInfo(sourceFilePath, "")
            if (cacheInfo && cacheInfo.mtime > fileInfo.mtime) {
                // use the cache entry
                result = getFileContents(packagesPath + ".json", cacheDir)
            }
        }

        if (result == null) {
            
            result = Terser.minify(source, terserOpts);    
                         
            if (cacheDir) {
                // save to cache
                writeFileContents(packagesPath + ".json", cacheDir, result)
            }    

            LOG('\n'+result.code, verbose);        
        }
        
        var sourceMap = JSON.parse(result.map);

        //console.log("Items in name cache: " + terserOpts.nameCache.props.props.size)
        //console.log(opts.keyCount + ' -> ' + terserOpts.nameCache.props.props.size);                
        //opts.keyCount = terserOpts.nameCache.props.props.size;
    } catch (e) {
        log.error(e);
        log.error(result);
        throw new Error;
    }

    if (inputSourceMap) {
      mergeSourceMap(sourceMap, inputSourceMap).then(mapResult => callback(null, result.code, mapResult));      
    } else {
      var current = loaderUtils.getCurrentRequest(this);
      sourceMap.sources = [sourceFilename];
      sourceMap.file = current;
      sourceMap.sourcesContent = [source];

      callback(null, result.code, sourceMap);
    }
};