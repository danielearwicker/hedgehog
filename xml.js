var dom = new (require('xmldom').DOMImplementation)();

function xml(tree, node) {
    var doc = node ? node.ownerDocument : dom.createDocument();    
    if (!node) {
        node = doc;
    }
    Object.keys(tree).forEach(function(key) {
        if (key[0] === '$') {
            var attr = doc.createAttribute(key.substr(1));
            attr.value = tree[key].toString();
            node.attributes.setNamedItem(attr);
        } else {
            var elem = doc.createElement(key);
            node.appendChild(elem);
            var val = tree[key];
            if (typeof val === 'string') {
                elem.nodeValue = val;
            } else if (val && typeof val === 'object') {                
                if (Array.isArray(val)) {
                    val.forEach(function(item) {
                        xml(item, elem);
                    });
                } else {
                    xml(val, elem);    
                }                
            }
        }
    });
    return node;
}

module.exports = xml;