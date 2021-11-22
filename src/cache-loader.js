const cache = require('./cache')
const loaderUtils = require('loader-utils')

// Super hack to work-around this.query being not accessible for redefinition and is readonly
// cache-loader uses an older loaderUtils.getOptions() api which can be monkey-patched
var globalQuery = null
const orig = loaderUtils.getOptions

loaderUtils.getOptions = function() {    
    if (globalQuery) {        
        return globalQuery
    }
    return orig.apply(null, arguments)
}

const cacheLoader = {
    loader: 'cache-loader',
    enforce: 'post',
    options: {
        cacheKey: cache.cacheKey,
        read: cache.readCache,
        write: cache.writeCache,
        compare: cache.compareCache
    }
}
module.exports = code => code

const cacheLoaderModule = require('cache-loader')

module.exports = {
    default: function(content) { 
        globalQuery = cacheLoader.options
        //console.log("CACHE: ", this.request, content, globalQuery)        
        let retval = cacheLoaderModule.default.apply(this, arguments)
        globalQuery = null
        return retval
    },

    pitch: function() {               
        //console.log("PITCH: ", this.request)
        globalQuery = cacheLoader.options
        let retval = cacheLoaderModule.pitch.apply(this, arguments)
        globalQuery = null
        return retval
    }
}
