const Terser = require('terser');
const loaderUtils = require('loader-utils');
const sourceMap = require('source-map');
const extend = require('extend');
const getLogger = require('webpack-log');
const log = getLogger({ name: 'terser-loader' });
const cache = require('./cache')

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

function initializeNameCache(nameCache, rootDir) {
 
  rootDir = rootDir || process.env.ROOT_DIR

  if (!("props" in nameCache)) {
    nameCache.props = {
      props: new Map(),
      propsExt: new Map()    
    }
  }

  const elements = cache.readNameCache(rootDir, {})
  for (var e in elements) {

    nameCache.props.props.set(e, elements[e].value)
    nameCache.props.propsExt.set(e, elements[e])
  }
  
}

module.exports = async function(source, inputSourceMap) {
    var sourceFilename = /*inputSourceMap && inputSourceMap.sources[0] || */ this.resourcePath;    

    var callback = this.async();

    if (this.cacheable) {
        this.cacheable(true); 
    }
  
    let firstTerser = this.loaders.findIndex((it, idx) => it.path == require.resolve("./index.js"))
    if (this.loaderIndex > firstTerser) {        
        callback(null, source, inputSourceMap);
        //LOG("Skipping", true);
        //LOG(this.request, true);
        //LOG(this.loaders, true);
        //LOG(source, true);
        return
    }

    if (this.resourceQuery != "" && 
        !this.resourceQuery.includes("lang=js") && 
        !this.resourceQuery.includes("lang=ts") && 
        !this.resourceQuery.includes("type=template")) {
        callback(null, source, inputSourceMap);
        return
    }

    var opts = this.query;
    var rules = opts.rules || [];    
    var rootDir = opts.rootDir || process.env.ROOT_DIR
    var cacheDir = opts.cacheDir || process.env.CACHE_DIR
    var packagesDir = opts.packagesDir || process.env.PACKAGES_DIR
    var terserDefaultOpts = opts.default || {};
    var terserOpts = terserDefaultOpts || {};
    var verbose = opts.verbose

    LOG(this.resource, verbose);
    //LOG(this.resourcePath, true);
    //LOG(this.request, true);    
    //LOG(sourceFilename, verbose);
    var overridden = false;

    var matchedRules = rules.filter(it => {
        if (it.test) {
            if (Array.isArray(it.test)) {
                return it.test.filter(it => new RegExp(it).test(this.resource)).length > 0;                    
            }
            return new RegExp(it.test).test(sourceFilename)
        }
        return false
    });

    // do not deep copy the name cache
    var nameCache = terserOpts.nameCache;
        
    if (matchedRules.length > 0) {

        // choose the rule with highest priority
        matchedRules = matchedRules.sort((a, b) => (a.priority || 0) - (b.priority || 0))
        
        overridden = true;
        var origOpts = terserOpts;
        terserOpts.nameCache = null;

        //clone and extend
        let matchedRule = matchedRules[matchedRules.length - 1]
        LOG("Overridden rule: " + matchedRule.test, verbose);  
        
        terserOpts = extend(true, {}, terserOpts, matchedRule.options);               

        // use the original object reference for the nameCache
        terserOpts.nameCache = origOpts.nameCache = nameCache;                 

    }

    terserOpts.sourceMap = {
        filename: sourceFilename,
        url: sourceFilename + ".map"      
    };

    var result = null;
    try {                
        
        if (typeof source == "object") {
            source = source.result.toString()
        }

        //LOG(source, true);     
        
        initializeNameCache(nameCache, rootDir)
    
        if (result == null) {

            const { packageRootPath, localPackagePath, packagePath } = cache.getCachePaths(sourceFilename, cacheDir, packagesDir, this.context)
                        
            result = await Terser.minify(source, terserOpts);    
                 
            //LOG('\n'+result.code, verbose);   
            
            if (cacheDir) {

                //cache.writeCache.call(this, sourceFilename + this.resourceQuery, result)

                // write translation table
                if (terserOpts.mangle && terserOpts.mangle.properties && terserOpts.mangle.properties.cache) {
                    cache.writeNameCache(rootDir, terserOpts.mangle.properties.cache)
                    cache.writeTranslationTable(rootDir)
                    //LOG("Package path: " + packagePath + ", " + packageRootPath, true)
                    if (packagePath != packageRootPath) {
                      cache.copyPackageFile(packagePath, packageRootPath)
                      cache.updatePackageFileEntries(localPackagePath, packageRootPath)
                    }

                    // clear cache since we are using the file to synchronize            
                    //terserOpts.mangle.properties.cache.props = terserOpts.nameCache.props = {}        
                }
            }                
        }
        
        var sourceMap = JSON.parse(result.map);

        //LOG(result.code, true)
        //LOG(terserOpts.mangle.properties.cache.props, true)
        //LOG(terserOpts.nameCache, true)
        //LOG(opts.ident, true)

        //console.log("Items in name cache: " + terserOpts.nameCache.props.props.size)
        //console.log(opts.keyCount + ' -> ' + terserOpts.nameCache.props.props.size);                
        //opts.keyCount = terserOpts.nameCache.props.props.size;
    } catch (e) {
        log.error("Error while processing: ", sourceFilename)    
        //log.error("Source: ")
        //log.error(source)    
        log.error(e);
        //log.error(result);
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

module.exports.initializeNameCache = initializeNameCache