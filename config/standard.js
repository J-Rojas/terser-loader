const manglePropertiesFull = {    
    keep_quoted: false,
    debug: {
        prefix: '\u01C3_',
        suffix: '_\u01C3'
    },          
    reserved: [
        // id is usually a unmodifiable property
        "id",
        /* protect module exports */
        "exports", "__esModule",                  
        /* define property api */
        "enumerable", "configurable", "writable",
        // used in rosbag processing                 
        "transforms", "child_frame_id",
        // DOM events
        "click", "mousemove", "mousedown", "mouseup", "touchstart", "touchend", "touchmove", "wheel", "contextmenu", "mouseenter", "mouseleave", "pointerdown", "pointerup",
        // DOM methods
        "replaceWith",        
        // worker
        "importScripts",
        // logging
        "debuglog",
        "NOBF"
    ],
    excludeParents: [   
        /* node reserved words */     
        "process", "module"        
    ],
    includeParents: [                        
        { name: "_defineProperty", index: 1 }, 
        // decorators do not appear to obfuscate easily :-(
        //"__decorate",
        "hasOwnProperty", "SYM"
    ],
    excludeTree: [        
        "NOBF", 
        // exclude the 'debuglog' statements so they can be removed using the compress options
        "debuglog"
    ]
}

module.exports = {
    manglePropertiesFull
}