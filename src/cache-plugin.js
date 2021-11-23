const cache = require('./cache')
const util = require('util')

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

        // find Vue pitcher

        const vuePitcherIndex = compiler.options.module.rules.findIndex(it => it.loader && it.loader.includes('vue-loader') && it.loader.includes('pitcher'))

        // add a global pitcher to cache all resources
        if (vuePitcherIndex == -1) {
            compiler.options.module.rules =[
                pitcher,
                ...compiler.options.module.rules
            ]            
        } else {
            // remove the vue pitcher ... it isn't compatible to wrap it... must be inlined
            compiler.options.module.rules.splice(vuePitcherIndex, 1, pitcher)
        }            
    }
}

class VuePrecomiledPlugin {
    apply(compiler) {

        const pitcher = {
            loader: require.resolve('./vue-precompiled-loader-prep.js')
        }
        
        // modify vue rules to exclude reprocessing vue import paths that have been preprocessed
        compiler.options.module.rules.forEach(it => { 
        
            
            if (it.test instanceof RegExp && it.test.test('hello.vue')) {
                //console.log(it)
                it.use = [
                    pitcher,
                    ...it.use
                ]
            } else if (it.oneOf instanceof Array) {

                let vueStyle = false
                it.oneOf.forEach(it => {
                    it.use.forEach(l => {
                        vueStyle |= l.loader.indexOf('vue-style') != -1
                    })                    
                })
                if (vueStyle) {
                    it.use = [
                        pitcher,
                        ...it.use
                    ]   
                }
            } 
            
            // install a nested rule on the vue pitching loader
            if (it.loader && it.loader.includes("vue-loader") && it.loader.includes("pitcher")) {
                it.rules = [{                    
                    enforce: 'post',
                    use: pitcher
                }]
            }

            //console.log(util.inspect(it, { showHidden: false, depth: 5, colors: true }))           
        })
    }
}

module.exports = { 
    CachePlugin,
    VuePrecomiledPlugin
}