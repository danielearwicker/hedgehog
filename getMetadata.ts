import musicmetadata = require("musicmetadata");
import fs = require("fs");
import path = require("path");

function metadata(filePath: string): Promise<MusicMetadata.Metadata> {
    
    var parser = musicmetadata(fs.createReadStream(filePath));
    
    var metadata: MusicMetadata.Metadata;
    parser.on("metadata", function(result) {
        metadata = result;
    });

    return new Promise<MusicMetadata.Metadata>((done, fail) => {
        parser.on("done", function(ex) {
            if (ex || !metadata) {
                // Fake metadata from some assumptions about the path
                var albumPath = path.dirname(filePath),
                    artistPath = path.dirname(albumPath);

                done(<MusicMetadata.Metadata>{
                    album: path.basename(albumPath),
                    artist: [path.basename(artistPath)],
                    title: path.basename(filePath)
                });
            } else {
                done(metadata);
            }
        });
    });
}

export = metadata;