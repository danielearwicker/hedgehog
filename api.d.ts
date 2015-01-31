
declare module Spiny {

    interface Hit {
        value: string;
        coverart: string;
        
        id?: number;
        album?: string;
        artist?: string;
        title?: string;
    }
    
    interface Results {
        [indexName: string]: Hit[];
    }
}
