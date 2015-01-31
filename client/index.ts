
function synchronize<T>(init: T, obs: KnockoutObservable<T | JQueryPromise<T>>) {
    var latest = ko.observable(init), waitingOn = 0;
    ko.computed(function() {
        var v = obs();
        var w = ++waitingOn;
        var p = <JQueryPromise<T>>v;
        if (p.done) {
            p.done(function(v) {
                if (w === waitingOn) {
                    latest(v);
                }
            });
        } else {
            latest(<T>v);
        }
    });
    return latest;
}

module viewModel {
    
    export var editableSearchText = ko.observable("");
    var searchText = ko.observable("");

    ko.computed(function() {
        var oldText = decodeURIComponent(window.location.hash.substr(1));
        var newText = editableSearchText().trim();
        if (oldText != newText) {
            console.log("Updating hash because " + oldText + " != " + newText);
            window.location.hash = '#' + newText;
        }
    }).extend({ throttle: 500 });
    
    window.addEventListener("hashchange", function() {
        var newText = decodeURIComponent(window.location.hash.substr(1));
        searchText(newText);
        editableSearchText(newText);
    }, false);
    
    export var playerQueue = ko.observableArray();
    export var nowPlaying = ko.observable();

    function queue(track: Spiny.Hit) {
        if (!track.id) {
            return;
        }
        var details = $.extend({}, track, {
            caption: track.value,
            imageSource: track.coverart
                ? "coverart?name=" + encodeURIComponent(track.coverart)
                : "img/missingart.png",
            stream: "stream?id=" + track.id
        });
        if (nowPlaying()) {
            playerQueue.push(details);
        } else {
            nowPlaying(details);
        }
    }
    
    function queueAlbum(album: Spiny.Hit) {
        $.get("fetch?type=album&name=" + encodeURIComponent(album.value)).done(function(results) {
            results.title.forEach(queue);
        });
    }
    
    export var searchResults = synchronize([], ko.computed(function() {
        var text = searchText();
        if (!text) {
            return [];
        }
        
        var query: JQueryPromise<Spiny.Results>;
        var bar = text.indexOf("|");
        if (bar === -1) {
            query = $.get("query?value=" + encodeURIComponent(text));
        } else {
            query = $.get("fetch?type=" + text.substr(0, bar) + 
                          "&name=" + encodeURIComponent(text.substr(bar + 1)));
        }
        
        return query.then(function(results) {
            return Object.keys(results).map(function(indexName) {
                var indexHits = results[indexName];
                return {
                    index: indexName,
                    hits: indexHits.map(function(hit) {
                        return {
                            caption: hit.value,
                            imageSource: hit.coverart
                                ? "coverart?name=" + encodeURIComponent(hit.coverart)
                                : "img/missingart.png",
                            link: "#" + (hit.id
                                ? "id|" + hit.id
                                : indexName + "|" + encodeURIComponent(hit.value)),
                            play: hit.id 
                                ? function() { queue(hit); } 
                                : indexName === "album" 
                                    ? function() { queueAlbum(hit); } 
                                    : null
                        };
                    })
                };
            });
        });
    }));

    export function playNext() {
        nowPlaying(playerQueue.shift());
    } 
};

ko.applyBindings(viewModel);