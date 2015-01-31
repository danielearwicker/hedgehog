/// <reference path="../node/node.d.ts" />

declare module MusicMetadata {
    interface Numbering {
        no: number;
        of: number;
    }
    
    interface Metadata {
        artist: string[];
        album: string;
        albumartist: string[];
        title: string;
        year: string
        track: Numbering;
        disk: Numbering;
        genre: string[];
        picture: { 
            format: string; 
            data: Buffer;
        }[];   
        duration: number;
    }
    
    interface Parser {
        on(event: "metadata", callback: (metadata: Metadata) => void): void;
        on(event: "done", callback: (error: Error) => void): void;
        on(event: string, callback: (result: any) => void): void;
    }
}

declare module "musicmetadata" {
    
    function _construct(stream: NodeJS.ReadableStream): MusicMetadata.Parser;
    export = _construct;
}
