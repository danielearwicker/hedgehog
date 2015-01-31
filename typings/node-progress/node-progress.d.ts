
/// <reference path="../node/node.d.ts" />

declare module NodeProgress {
    
    interface ProgressBar {
        tick(): void;
        complete: boolean;
    }
    
    interface Options {
        total: number;
        width?: number;
        stream?: NodeJS.WritableStream;
        complete?: string;
        incomplete?: string;
        clear?: boolean;
        callback?: () => void;
    }

    interface ProgressBarConstructor {
        new(format: string, options: Options): ProgressBar; 
    }
}

declare module "progress" {
    var _ctor: NodeProgress.ProgressBarConstructor;
    export = _ctor;    
}
