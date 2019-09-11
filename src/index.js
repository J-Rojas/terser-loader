const Terser = require('terser');
const loaderUtils = require('loader-utils');
const sourceMap = require('source-map');

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

module.exports = function(source, inputSourceMap) {
    var callback = this.async();


    if (this.cacheable) {
      this.cacheable(); 
    }

    var sourceFilename = inputSourceMap ? inputSourceMap.sources[0] : this.resourcePath;

    console.log(sourceFilename);

    var opts = loaderUtils.getOptions(this) || {};
    opts.sourceMap = {
        filename: sourceFilename,
        url: sourceFilename + ".map"      
    };


    
    var result = Terser.minify(source, opts);
    //console.log(result);
    var sourceMap = JSON.parse(result.map);
    //console.log(result.code);
    
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