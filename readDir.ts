import fs = require("fs");
import path = require("path");

function recurse(p: string, results: string[], done: (err: Error) => void) {
    fs.stat(p, function(err, s) {

        if (err) {
            done(err);
            return;
        }

        if (!s.isDirectory()) {
            results.push(p);
            done(null);
            return;
        }

        fs.readdir(p, function(err, children) {
            if (err) {
                done(err);
                return;
            }
            var n = children.length;
            function complete() {
                if (--n == 0) {
                    done(null);
                }
            }
            children.forEach(child => {
                if (child[0] !== ".") {
                    recurse(path.join(p, child), results, complete);
                } else {
                    complete();
                }
            });
        });
    });
}

function readDir(rootPath: string): Promise<string[]> {
    var ar: string[] = [];
    return new Promise<string[]>((done, fail) => {
        recurse(rootPath, ar, err => {
            if (err) {
                fail(err);
            } else {
                done(ar);
            }
        });
    });
}

export = readDir;