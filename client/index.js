
function synchronize(init, obs) {
    var latest = ko.observable(init), waitingOn = 0;
    ko.computed(function() {
        var p = obs();
        var w = ++waitingOn;
        if (p.done) {
            p.done(function(v) {
                if (w === waitingOn) {
                    latest(v);
                }
            });
        } else {
            latest(p);
        }
    });
    return latest;
};

var editableSearchText = ko.observable("");
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

var playerQueue = ko.observableArray();
var nowPlaying = ko.observable();

function queue(track) {
    if (!track.id) {
        return;
    }
    var details = $.extend({}, track, {
        caption: track.value,
        imageSource: track.coverart
            ? "coverart?name=" + encodeURIComponent(track.coverart)
            : "missingart.png",
        stream: "stream?id=" + track.id
    });
    if (nowPlaying()) {
        playerQueue.push(details);
    } else {
        nowPlaying(details);
    }
}

function queueAlbum(album) {
    $.get("fetch?type=album&name=" + encodeURIComponent(album.value)).done(function(results) {
        results.title.forEach(queue);
    });
}

var searchResults = synchronize([], ko.computed(function() {
    var text = searchText();
    if (!text) {
        return [];
    }
    
    var query;
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
                            : "missingart.png",
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

var viewModel = {
    searchText: editableSearchText,
    searchResults: searchResults,
    nowPlaying: nowPlaying,
    playerQueue: playerQueue,
    playNext: function() {
        nowPlaying(playerQueue.shift());
    }
};

ko.applyBindings(viewModel);