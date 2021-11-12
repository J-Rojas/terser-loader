const cache = require('./cache')
const loaderUtils = require('loader-utils')

// Super hack to work-around this.query being not accessible for redefinition and is readonly
// cache-loader uses an older loaderUtils.getOptions() api which can be monkey-patched
let globalQuery = null
const orig = loaderUtils.getOptions
loaderUtils.getOptions = function() {
    if (globalQuery) {
        return globalQuery
    }
    return orig.apply(this, arguments)
}

const cacheLoader = {
    loader: 'cache-loader',
    options: {
        cacheKey: cache.cacheKey,
        read: cache.readCache,
        write: cache.writeCache,
        //compare: cache.compareCache
    }
}
module.exports = code => code

const cacheLoaderModule = require('cache-loader')

module.exports = {
    default: function() {
        globalQuery = cacheLoader.options
        let retval = cacheLoaderModule.default.apply(this, arguments)
        globalQuery = null
        return retval
    },

    pitch: function() {        
        globalQuery = cacheLoader.options
        let retval = cacheLoaderModule.pitch.apply(this, arguments)
        globalQuery = null
        return retval
    }
}
