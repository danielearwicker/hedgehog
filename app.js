var express = require('express');
var bodyParser = require('body-parser')
var xml = require('./xml.js');
var fs = require('fs');
var path = require('path');
var musicmetadata = require('musicmetadata');

function err(action) {
    return function(err, result) {
        if (err) {
            console.log(err);
        } else {
            action(result);
        }
    }
}

function recurseFiles(p, each, done) {
    
    fs.stat(p, err(function(s) {
        if (s.isDirectory()) {
            fs.readdir(p, err(function(ar) {
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
            }));
        } else {
            each(p, done);
        }
    }));
}

recurseFiles(process.argv[2], function(filePath, done) {
    var parser = musicmetadata(fs.createReadStream(filePath));
    parser.on('metadata', function (result) {
      console.log(result);
      done();
    });
}, function() {
    console.log("DONE!");
});

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function api(name, func) {
    var wrapper = function(args, req, res) {    
        var response = xml({ 'subsonic-response': func(args, req) }).toString();
        console.log('Response: ' + JSON.stringify(response, null, 4));
        res.set('Content-Type', 'application/xml');
        res.send(response);
    }
    name = '/rest/' + name + '.view';
    app.get(name, function(req, res) {
        wrapper(req.query, req, res);
    });
    app.post(name, function(req, res) {
        wrapper(req.body, req, res);
    });
}

api('ping', function() {});

api('getMusicFolders', function() { 
    return {
        musicFolders: [{
            musicFolder: { $id: 1, $name: 'Audio' }
        }, {
            musicFolder: { $id: 2, $name: 'Video' }            
        }]
    }
});

api('getIndexes', function() { 
    return {
        indexes: [{
            $lastModified: '237462836472342', $ignoredArticles: 'The El La Los Las Le Les'            
        }, {
            shortcut: { $id: 1, $name: 'Audio' }
        }, {
            shortcut: { $id: 2, $name: 'Video' }        
        }, {
            index: [
                { $name: 'A'}, 
                { artist: { $id: '1', $name: 'ABBA' } },
                { artist: { $id: '2', $name: 'Alanis Morisette' } }
            ]
        }, {
            child: {
                $id: '111',
                $parent: '1',
                $title: 'Dancing Queen',
                $isDir: false,
                $album: 'Arrival',
                $artist: 'ABBA',
                $track: '7',
                $year: '1978',
                $genre: 'Pop',
                $size: '8421341',
                $contentType: 'audio/mpeg'
            }
        }]
    }
});

app.use(function (req, res, next) {
    console.log('Time: %d', Date.now());

    console.log('Path: ' + req.path);
    console.log('Query: ' + JSON.stringify(req.query, null, 4));
    console.log('Body: ' + JSON.stringify(req.body, null, 4));

    next();
});

app.listen(3000);

console.log('Server running at http://127.0.0.1:3000/');
