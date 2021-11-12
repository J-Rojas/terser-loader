const cache = require('./cache')

class CachePlugin {
    apply(compiler) {

        const pitcher = {
            loader: require.resolve('./cache-loader-prep.js'),
            resourceQuery: query => {            
                return true
            },
            exclude: [
                /node_modules/
            ],
            options: {
                cacheKey: cache.cacheKey,
                read: cache.readCache,
                write: cache.writeCache,
                compare: cache.compareCache        
            }
        }

        // add a global pitcher to cache all resources
        compiler.options.module.rules = [
            pitcher,
            ...compiler.options.module.rules
        ]
        
    }
}

module.exports = { 
    CachePlugin
}