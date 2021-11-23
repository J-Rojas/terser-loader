const merge = require('@brikcss/merge');
const { manglePropertiesFull } = require('./standard')

const terserNameCache = {}

const terserOptionsVue = {   
    verbose: false,            
    compress: false,  
    nameCache: terserNameCache,  
    mangle: {        
        reserved: ["document", "window"],
        exports: {            
            debug: {
                prefix: '\u01C3_',
                suffix: '_\u01C3'
            }            
        },          
        properties: {            
            keep_quoted: false,
            chaining: true,
            debug: {
                prefix: '\u01C3_',
                suffix: '_\u01C3'
            },               
            reserved: manglePropertiesFull.reserved.concat([   
                /* define property api */
                "enumerable", "configurable", "writable",          
                /* list of core vue component properties */
                "components", "component", "install", "directive", "directives", "mixin", "mixins", "methods", "computed", "watch", "props", "name", "data", "_scopeId", "extends", "createDecorator", 
                /* list of core vue component lifecycle methods */
                "beforeCreate", "created", "beforeMount", "mounted", "beforeUpdate", "updated", "beforeDestroy", "destroyed", "activated", "deactivated", "errorCaptured", "serverPrefetch", "render",
                /* Vue api */
                "nextTick", "$nextTick", "$emit", "$refs", "$slots", "$mount", "use", "$options", "$el", "$on", "$off", "defineReactive", "inject", "$forceUpdate", "provide",
                /* Router api */
                "$route", "$router", "router", "routes",
                // used in rosbag processing                 
                "transforms", "child_frame_id",
                // vue-class-component
                "Component", "Prop", "Inject"
            ]), 
            excludeParents: [
                "Vue",
                /* for initializing components and accessing references and properties */
                "components", "$refs", "$route", "$router", 
                // props are linked to 'attrs' globally
                { name: "props", scope: "global" }
            ],            
            includeParents: manglePropertiesFull.includeParents.concat([
                // force rename of inject/provided functions 
                "inject", "provide"
            ]),
            excludeTree: [
                "NOBF", "debuglog"
            ]            
        } 
    },          
    module: false,
    keep_classnames: false,
    keep_fnames: false,
    output: {
        beautify: true
    }        
};

const terserOptionsVueTemplates = {      
    nameCache: terserNameCache,
    compress: false,    
    mangle: {        
        reserved: ["document", "window"],
        exports: {
            debug: {
                prefix: '\u01C3_',
                suffix: '_\u01C3'
            },
            excluded: [
                "render", "staticRenderFns"
            ]
        }, 
        properties: {
            keep_quoted: false,
            debug: {
                prefix: '\u01C3_',
                suffix: '_\u01C3'
            },                          
            reserved: manglePropertiesFull.reserved.concat([ 
                /* protect module exports */
                "exports",            
                /* list of core vue component properties */
                "attrs", "components", "component", "directive", "directives", "$attrs", "$listeners", "$createElement", "staticRenderFns", "render", "ref", "refInFor", "scopedSlots", "slot", "slots", "fn", "_withStripped",
                "staticClass", "staticStyle", "model", "domProps", "class", "callback", "expression", "on", "proxy", "rawName", "is", "nativeOn", 
                /* Vue api */
                "nextTick", "$nextTick", "$emit", "$refs", "$mount", "$forceUpdate",
                /* Template helpers */
                "_self", "_v", "_u", "_g", "_e", "_s", "_l", "_t", "_c", "_b", "$set", "$get", "_ssrNode"
            ]),          
            excludeParents: [
                // certain attributes are tied to the Vue/Vuetify framework
                "Vue", "$refs", "$slots", 
                // attrs can be plentiful and they are accessed dynamically by name to map to their component's prop
                "attrs",
                // class will assign child keys as css classes so these children should remain unchanged
                "class",
                // events names are references through "on"
                "on", "nativeOn"
            ],
            excludeTree: [
                "NOBF"
            ],            
            translation: {
                full: {
                    reserved: true
                    /*declarations: [ "DEFAULT_ATTRS" ]*/
                }
            }            
        } 
    },          
    module: false,
    keep_classnames: false,
    keep_fnames: false,
    output: {
        beautify: true
    }        
};

const terserOptionsVueTemplateComponents = merge({}, terserOptionsVueTemplates)
merge.arrays(terserOptionsVueTemplateComponents.mangle.properties.reserved, terserOptionsVue.mangle.properties.reserved);
merge.arrays(terserOptionsVueTemplateComponents.mangle.properties.excludeParents, terserOptionsVue.mangle.properties.excludeParents);
merge.arrays(terserOptionsVueTemplateComponents.mangle.properties.includeParents, terserOptionsVue.mangle.properties.includeParents);

const terserVueTemplateLoaderOptions = {                    
    verbose: false,
    default: terserOptionsVueTemplates        
}

module.exports = {
    terserNameCache,
    terserOptionsVue,    
    terserOptionsVueTemplateComponents,
    terserVueTemplateLoaderOptions
}