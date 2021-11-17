const fs = require('fs')

module.exports = {
    pitch: function() {        
        // resolve the request for any precompiled resources
        //const p = `${this.resourcePath.replace(/.js$/, "") + this.resourceQuery}.js`
        //console.log("remaining request: " + this.remainingRequest, process.env.CACHE_DIR)
        if (this.resourcePath.startsWith(process.env.CACHE_DIR) && this.resourcePath.endsWith(".vue") && fs.existsSync(this.resource)) {
            //console.log("Reading preprocessed file: " + this.resource)            
            this.addDependency(this.resource)
            return fs.readFileSync(this.resource).toString()
        }

        //console.log("not preprocessing file: ", this.resource, this.resourcePath)        
    }
}
