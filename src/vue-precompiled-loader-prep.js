const fs = require('fs')

module.exports = {
    pitch: function() {        
        // resolve the request for any precompiled resources
        //const p = `${this.resourcePath.replace(/.js$/, "") + this.resourceQuery}.js`
        //console.log("remaining request: " + this.request, process.env.CACHE_DIR,
        //this.resourcePath.startsWith(process.env.CACHE_DIR))

        if (this.resourcePath.startsWith(process.env.CACHE_DIR) &&
            (this.resource.includes(".vue") ||
            this.resourcePath.endsWith(".css"))) {
            if (fs.existsSync(this.resource)) {
                this.addDependency(this.resource)                
                //console.log("Reading preprocessed file: " + this.resource)                        
                return this.loadModule(`${this.resourcePath}`, (err, source, sourceMap, module) => {                    
                    
                })
            }            
        }

        //console.log("not preprocessing file: ", this.resource, this.resourcePath)        
    }
}
