var dom = new (require('xmldom').DOMImplementation)();

function xml(tree: any, node?: any) {
    var doc = node ? node.ownerDocument : dom.createDocument();    
    if (!node) {
        node = doc;
    }
    if (Array.isArray(tree)) {
        tree.forEach(function(item: any) {
            xml(item, node);
        });
        return null;
    }
    if (typeof tree === "string" || typeof tree === "number") {
        node.appendChild(doc.createTextNode(tree + ""));
        return null;
    }
    if (tree && typeof tree === "object") {
        Object.keys(tree).forEach(function(key) {
            if (key[0] === "$") {
                var attr = doc.createAttribute(key.substr(1));
                attr.value = tree[key].toString();
                node.attributes.setNamedItem(attr);
            } else {
                var elem = doc.createElement(key);
                node.appendChild(elem);
                var val = tree[key];
                if (typeof val === "string") {
                    elem.appendChild(doc.createTextNode(val));
                } else {
                    xml(val, elem);
                }
            }
        });
        return node;
    }
    return null;
}

export = xml;