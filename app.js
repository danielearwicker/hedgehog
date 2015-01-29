var express = require('express');
var bodyParser = require('body-parser');
var xml = require('./xml.js');
var fs = require('fs');
var path = require('path');
var musicmetadata = require('musicmetadata');
var mime = require('mime');

function recurseFiles(p, each, done) {
    fs.stat(p, function(err, s) {
        if (!err && s.isDirectory()) {
            fs.readdir(p, function(err, ar) {
                if (err) {
                    console.log(err);
                    done();
                    return;
                }
                var n = 0;
                function step() {
                    if (n === ar.length) {
                        done();
                    } else {
                        var child = ar[n++];
                        if (child[0] !== ".") {
                            recurseFiles(path.join(p, child), each, step);
                        } else {
                            step();
                        }
                    }
                }
                step();
            });
        } else {
            each(p, done);
        }
    });
}

var metabasePath = path.join(__dirname, "metabase");
if (!fs.existsSync(metabasePath)) {
    fs.mkdirSync(metabasePath);
}

var coverartPath = path.join(metabasePath, "coverart");
if (!fs.existsSync(coverartPath)) {
    fs.mkdirSync(coverartPath);
}

var libraryPath = process.argv[2];

var metabaseFile = path.join(metabasePath, "metabase.json");
var metabase = [];
var indices = {};

console.log("Loading metabase...");
fs.readFile(metabaseFile, function(err, metabaseJson) {

    console.log("Parsing metabase...");
    var loadedMetabase = err ? [] : JSON.parse(metabaseJson);
    var changes = !!err;

    console.log("Cross-referencing with " + loadedMetabase.length + " items...");
    var metabaseByPath = {};
    loadedMetabase.forEach(function(item) {
        try {
            var s = fs.statSync(path.join(libraryPath, item.path));
            if (s) {
                var modified = s.mtime.toISOString();
                if (modified === item.modified) {
                    metabaseByPath[item.path] = item;
                } else {
                    changes = true;
                }
            } else {
                changes = true;
            }
        } catch (x) {
            // Ignore exceptions, probably file has disappeared
            console.log("Disappeared: " + item.path);
            changes = true;
        }
    });

    console.log("Scanning library for changes...");
    recurseFiles(libraryPath, function(filePath, done) {
        var relPath = filePath.substr(libraryPath.length);
        if (relPath[0] === '/') {
            relPath = relPath.substr(1);
        }
        if (metabaseByPath[relPath]) {
            done();
            return;
        }
        console.log("Detected: " + relPath);
        changes = true;
        var parser = musicmetadata(fs.createReadStream(filePath));
        var metadata;
        parser.on('metadata', function(result) {
            metadata = result;
        });
        parser.on('done', function(ex) {
            var finish = function () {
                fs.stat(filePath, function(err, s) {
                    if (!err) {
                        metadata.modified = s.mtime.toISOString();
                        metadata.path = relPath;
                        metabaseByPath[relPath] = metadata;
                    }
                    done();
                });
            };
            if (ex || !metadata) {
                // Fake metadata from some assumptions about the path
                var albumPath = path.dirname(relPath),
                    artistPath = path.dirname(albumPath);            
                metadata = {
                    album: path.basename(albumPath),
                    artist: path.basename(artistPath),
                    title: path.basename(relPath)
                };
                finish();
            } else {             
                var pictureData = metadata.picture && metadata.picture[0];
                if (pictureData) {
                    delete metadata.picture;

                    // Only keep one image per folder, as this is almost always correct
                    var imageName = path.dirname(relPath).replace(/[\\\/]/g, '_');
                    imageName += "." + pictureData.format;
                    var imagePath = path.join(coverartPath, imageName);

                    fs.exists(imagePath, function(exists) {
                        if (exists) {
                            metadata.coverart = imageName;
                            finish();
                        } else {
                            fs.writeFile(imagePath, pictureData.data, function (err) {
                                if (!err) {
                                    metadata.coverart = imageName;
                                }
                                finish();
                            });
                        }
                    });
                } else {
                    finish();
                }
            }
        });
    }, function() {
        console.log("Compiling metabase...");
        for (var relPath in metabaseByPath) {
            var item = metabaseByPath[relPath];
            metabase.push(item);
            
            Object.keys(item).forEach(function(key) {
                var index = indices[key] || (indices[key] = {});
                var vals = item[key];
                vals = Array.isArray(vals) ? vals : [vals];
                vals.forEach(function(val) {
                    var contents = index[val] || (index[val] = []);
                    contents.push(item);
                });
            });
        }

        if (changes) {
            console.log("Saving updated metabase...");                    
            fs.writeFileSync(metabaseFile, JSON.stringify(metabase, null, 4));
        }
        
        console.log("Assigning IDs");
        metabase.forEach(function(item, id) {
            item.id = id;
        });
        
        console.log("Up to date");
    });
});

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function api(name, func) {
    app.get('/' + name, function(req, res) {
        res.set("Content-Type", "application/json");
        res.send(JSON.stringify(func(req.query, req), null, 2));
    });
}

app.get('/coverart', function(req, res) {
    var p = path.join(coverartPath, req.query.name);  
    res.setHeader("Content-Type", mime.lookup(p));
    fs.createReadStream(p).pipe(res);    
});

api('query', function(args) {
    if (!args.value) {
        return {
            info: "Specify url parameter: value (optionally: index, skip, take)",
            stats: {
                items: metabase.length,
                indices: Object.keys(indices).map(function(index) {
                    return { index: index };
                })
            }
        };
    }

    var lowerVal = args.value.toLowerCase();
    var results = {};
    
    var indexNames = args.index ? [args.index.toLowerCase()] : ["artist","album","title","genre"];
    indexNames.forEach(function(indexName) {
        var index = indices[indexName];
        if (!index) {
            return { error: "No such index: " + indexName };
        }

        var skip = parseInt(args.skip || "0", 10), take = parseInt(args.take || "20", 10);

        var hits = [];
        for (var key in index) {
            if (take === 0) {
                break;
            }
            if (key.toLowerCase().indexOf(lowerVal) !== -1) {
                if (skip > 0) {
                    skip--;
                } else {
                    take--;
                    
                    var coverart;
                    index[key].some(function(item) {
                        return !!(coverart = item.coverart);
                    });
                    
                    hits.push({
                        value: key,
                        coverart: coverart
                    });
                }
            }
        }
        if (hits.length > 0) {
            results[indexName] = hits;
        }
    });
    
    return results;
});

app.use(express.static(__dirname + "/client"));

var port = 3002;
app.listen(port);
console.log('Server running at http://127.0.0.1:' + port + '/');
