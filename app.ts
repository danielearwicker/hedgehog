import express = require("express");
import bodyParser = require("body-parser");
import xml = require("./xml");
import fs = require("fs");
import path = require("path");
import mime = require("mime");
import ProgressBar = require("progress");
import readDir = require("./readDir");
import getMetadata = require("./getMetadata");

var metabasePath = path.join(__dirname, "metabase");
if (!fs.existsSync(metabasePath)) {
    fs.mkdirSync(metabasePath);
}

var coverartPath = path.join(metabasePath, "coverart");
if (!fs.existsSync(coverartPath)) {
    fs.mkdirSync(coverartPath);
}

var libraryPath = process.argv[2];
if (!libraryPath) {
    throw new Error("No library path specified");
}

interface Metadata extends MusicMetadata.Metadata {
    path: string;
    id: number;
    modified: string;
    coverart: string;
}

var metabaseFile = path.join(metabasePath, "metabase.json");
var metabase: Metadata[] = [];
var indices: {
    [indexName: string]: {
        [indexValue: string]: Metadata[];    
    }
} = {};

function forValuesIn(item: any, property: string, handler: (val: any) => void) {
    var vals = item[property];
    if (!Array.isArray(vals)) {
        handler(vals);
    } else {
        vals.forEach(handler);
    }
}

function relativePath(wholePath: string, parentPath: string) {
    var relPath = wholePath.substr(parentPath.length);
    return relPath[0] === "/" ? relPath.substr(1) : relPath;
}

console.log("Loading metabase...");
fs.readFile(metabaseFile, 'utf8', function(err, metabaseJson) {

    console.log("Parsing metabase...");
    var loadedMetabase: Metadata[] = err ? [] : JSON.parse(metabaseJson);
    var changes = !!err;

    console.log("Cross-referencing with " + loadedMetabase.length + " items...");
    var metabaseByPath: { [pathString: string]: Metadata } = {};

    var bar = new ProgressBar(':bar', { total: loadedMetabase.length, width: 40 });

    var removed: string[] = [];

    loadedMetabase.forEach(function(item) {
        try {
            bar.tick();
            var s = fs.statSync(path.join(libraryPath, item.path));
            if (s) {
                var modified = s.mtime.toISOString();
                if (modified === item.modified) {
                    metabaseByPath[item.path] = item;
                    return;
                } 
            } 
        } catch (x) {
            // Ignore exceptions, probably file has disappeared            
        }
        removed.push(item.path);
    });

    if (removed.length !== 0) {
        console.log("\n" + removed.length + " files were missing");
    }
    
    console.log("\nScanning library for new or modified files...");
    
    readDir(libraryPath).then(files => {
        
        bar = new ProgressBar("[:bar] :current/:total", { total: files.length, width: 40 });
        
        files = files.filter(f => !metabaseByPath[relativePath(f, libraryPath)]);        
        return files.length === 0 
            ? changes 
            : files.reduce((all, filePath) => all.then(() => getMetadata(filePath)).then(metadata => {

            bar.tick();

            var relPath = relativePath(filePath, libraryPath);
            
            var fullData: Metadata = <Metadata>metadata;
            fullData.path = relPath;

            var pictureData = metadata.picture && metadata.picture[0];
            delete metadata.picture;

            if (!pictureData) {
                return fullData;
            }

            // Only keep one image per folder, as this is almost always correct
            var imageName = path.dirname(relPath).replace(/[\\\/]/g, "_");
            imageName += "." + pictureData.format;
            var imagePath = path.join(coverartPath, imageName);

            return new Promise<Metadata>((done, fail) => {                
                fs.exists(imagePath, function(exists) {
                    if (exists) {
                        fullData.coverart = imageName;
                        done(fullData);
                    } else {
                        fs.writeFile(imagePath, pictureData.data, function (err) {
                            if (!err) {
                                fullData.coverart = imageName;
                                done(fullData);
                            } else {
                                fail(err);
                            }
                        });
                    }
                });
            });
            
        }).then(fullData => {

            return new Promise<void>((done, fail) => {
                fs.stat(filePath, function(err, s) {
                    if (!err) {
                        fullData.modified = s.mtime.toISOString();                        
                        metabaseByPath[fullData.path] = fullData;
                        done();
                    } else {
                        fail(err);
                    }
                });
            });

        }), Promise.resolve<void>()).then(() => true)

    }).then(changes => {

        console.log("\nCompiling metabase...");
        for (var relPath in metabaseByPath) {
            var item = metabaseByPath[relPath];
            metabase.push(item);            
            Object.keys(item).forEach(function(key) {
                var index = indices[key] || (indices[key] = {});                
                forValuesIn(item, key, val => {
                    var contents = index[val] || (index[val] = []);
                    contents.push(item);
                });
            });
        }

        if (changes) {
            console.log("Saving updated metabase...");                    
            fs.writeFile(metabaseFile, JSON.stringify(metabase, null, 4), err => console.log(err));
        }

        console.log("Assigning IDs");
        metabase.forEach((item, id) => item.id = id);

        console.log("Up to date");
        
    }).catch(er => console.log(er));    
});

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function api(name: string, func: (query: any, req: Express.Request) => any) {
    app.get("/" + name, function(req, res) {
        var result = func(req.query, req);
        console.log(name, result);
        res.set("Content-Type", "application/json");
        res.send(JSON.stringify(result, null, 2));
    });
}

app.get("/coverart", function(req, res) {
    var p = path.join(coverartPath, req.query.name);  
    res.setHeader("Content-Type", mime.lookup(p));
    fs.createReadStream(p).pipe(res);    
});

app.get("/stream", function(req, res) {
    var item = metabase[req.query.id];
    if (!item) {
        res.status(500).send('Bad id');
    } else {
        var p = path.join(libraryPath, item.path);
        res.setHeader("Content-Type", mime.lookup(p));
        fs.createReadStream(p).pipe(res);
    }
});

interface ResultsMaker {
    (indexName: string, add: (value: string, coverart: string, item?: Metadata) => boolean): void;
}

interface PagingOptions {
    skip?: string;
    take?: string;
}

function makeResults(args: PagingOptions, handler: ResultsMaker): Spiny.Results {
    
    var results: Spiny.Results = {};
    
    ["genre", "artist", "album", "title"].forEach(indexName => {
        
        var skip = parseInt(args.skip || "0", 10), take = parseInt(args.take || "100", 10);
        var hits: Spiny.Hit[] = [];
    
        handler(indexName, function(value, coverart, item) {
            if (skip > 0) {
                skip--;
                return true;
            }
            if (take <= 0) {
                return false;
            }
            take--;
    
            var result: Spiny.Hit = { value: value, coverart: coverart };
            
            if (item) {
                result.id = item.id;
                result.album = item.album;
                result.artist = item.artist[0];
                result.title = item.title[0];                
            }
    
            hits.push(result);
            return take > 0;
        });

        if (hits.length !== 0) {
            results[indexName] = hits;
        }     
    });   
    
    return results;
}

api("fetch", function(args) {
    if (!args.type || !args.name) {
        throw new Error("Requires type, name parameters");
    }
    
    if (args.type === "id") {
        var item = metabase[args.name];
        if (!item) {
            return {};
        }
        return makeResults(args, function(indexName, add) {
            forValuesIn(item, indexName, function(val) {
                add(val, item.coverart);
            });
        });
    }
    
    var index = indices[args.type];
    if (!index) {
        return {};
    }
    var items = index[args.name];
    if (!items) {
        return {};
    }
    return makeResults(args, function(indexName, add) {
        var values: { [key: string]: boolean } = {};                
        items.forEach(function(item) {
            var itemFolder = path.dirname(item.path);
            forValuesIn(item, indexName, function(val) {
                var valKey = val;
                if (indexName === "title") {
                    valKey += "/" + itemFolder;
                }
                if (!values[valKey]) {
                    values[valKey] = true;
                    add(val, item.coverart, indexName === "title" ? item : null);
                }
            });
        });         
    });
});

api("query", function(args) {
    if (!args.value) {
        throw new Error("Requires value parameter");
    }

    var lowerVal = args.value.toLowerCase();
    
    return makeResults(args, function(indexName, add) {
        var index = indices[indexName];
        
        for (var key in index) {
            if (key.toLowerCase().indexOf(lowerVal) !== -1) {

                var items = index[key];

                if (indexName === "title") {
                    items.forEach(function(item) {
                        add(key, item.coverart, item);
                    });
                } else {
                    var coverart: string;
                    items.some(function(item) {
                        return !!(coverart = item.coverart);
                    });
                    add(key, coverart);
                }
            }
        }
    });
});

function subsonic(name: string, func: (query: any, req: express.Request) => Promise<any>) {
    var wrapper = function(args: any, req: express.Request, res: express.Response) {
        
        func(args, req).then(data => {
            
            var response = xml({ 'subsonic-response': data }).toString();
            console.log('Response: ' + JSON.stringify(response, null, 4));
            res.set('Content-Type', 'application/xml');
            res.send(response);    
            
        }).catch(err => {
            res.status(500).send(err.message);            
        });        
    }
    name = '/rest/' + name + '.view';
    app.get(name, function(req, res) {
        wrapper(req.query, req, res);
    });
    app.post(name, function(req, res) {
        wrapper(req.body, req, res);
    });
}

app.use(express.static(__dirname + "/client"));

var port = 3003;
app.listen(port);
console.log("Server running at http://127.0.0.1:" + port + "/");
