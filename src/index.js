const Terser = require('terser');
const loaderUtils = require('loader-utils');
const sourceMap = require('source-map');
const extend = require('extend');
const getLogger = require('webpack-log');
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

module.exports = function(source, inputSourceMap) {
    var callback = this.async();

    if (this.cacheable) {
      this.cacheable(); 
    }

    var sourceFilename = inputSourceMap ? inputSourceMap.sources[0] : this.resourcePath;

    var opts = this.query;
    var rules = opts.rules || [];
    var terserDefaultOpts = opts.default;
    var terserOpts = terserDefaultOpts;
    var verbose = opts.verbose
    
    LOG(sourceFilename, verbose);

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
        terserOpts.nameCache = null;

        //clone and extend
        LOG("Overridden rule: " + matchedRules[0].test, verbose);  
        
        terserOpts = extend(true, {}, terserOpts, matchedRules[0].options); 
        
        // use the original object reference for the nameCache
        terserOpts.nameCache = nameCache;
    }

    
    terserOpts.sourceMap = {
        filename: sourceFilename,
        url: sourceFilename + ".map"      
    };

    var result = null;
    try {                
        result = Terser.minify(source, terserOpts);                 
        var sourceMap = JSON.parse(result.map);

        LOG('\n'+result.code, verbose);
        
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