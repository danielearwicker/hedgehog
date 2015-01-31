function synchronize(init, obs) {
    var latest = ko.observable(init), waitingOn = 0;
    ko.computed(function () {
        var v = obs();
        var w = ++waitingOn;
        var p = v;
        if (p.done) {
            p.done(function (v) {
                if (w === waitingOn) {
                    latest(v);
                }
            });
        }
        else {
            latest(v);
        }
    });
    return latest;
}
var viewModel;
(function (viewModel) {
    viewModel.editableSearchText = ko.observable("");
    var searchText = ko.observable("");
    ko.computed(function () {
        var oldText = decodeURIComponent(window.location.hash.substr(1));
        var newText = viewModel.editableSearchText().trim();
        if (oldText != newText) {
            console.log("Updating hash because " + oldText + " != " + newText);
            window.location.hash = '#' + newText;
        }
    }).extend({ throttle: 500 });
    window.addEventListener("hashchange", function () {
        var newText = decodeURIComponent(window.location.hash.substr(1));
        searchText(newText);
        viewModel.editableSearchText(newText);
    }, false);
    viewModel.playerQueue = ko.observableArray();
    viewModel.nowPlaying = ko.observable();
    function queue(track) {
        if (!track.id) {
            return;
        }
        var details = $.extend({}, track, {
            caption: track.value,
            imageSource: track.coverart ? "coverart?name=" + encodeURIComponent(track.coverart) : "img/missingart.png",
            stream: "stream?id=" + track.id
        });
        if (viewModel.nowPlaying()) {
            viewModel.playerQueue.push(details);
        }
        else {
            viewModel.nowPlaying(details);
        }
    }
    function queueAlbum(album) {
        $.get("fetch?type=album&name=" + encodeURIComponent(album.value)).done(function (results) {
            results.title.forEach(queue);
        });
    }
    viewModel.searchResults = synchronize([], ko.computed(function () {
        var text = searchText();
        if (!text) {
            return [];
        }
        var query;
        var bar = text.indexOf("|");
        if (bar === -1) {
            query = $.get("query?value=" + encodeURIComponent(text));
        }
        else {
            query = $.get("fetch?type=" + text.substr(0, bar) + "&name=" + encodeURIComponent(text.substr(bar + 1)));
        }
        return query.then(function (results) {
            return Object.keys(results).map(function (indexName) {
                var indexHits = results[indexName];
                return {
                    index: indexName,
                    hits: indexHits.map(function (hit) {
                        return {
                            caption: hit.value,
                            imageSource: hit.coverart ? "coverart?name=" + encodeURIComponent(hit.coverart) : "img/missingart.png",
                            link: "#" + (hit.id ? "id|" + hit.id : indexName + "|" + encodeURIComponent(hit.value)),
                            play: hit.id ? function () {
                                queue(hit);
                            } : indexName === "album" ? function () {
                                queueAlbum(hit);
                            } : null
                        };
                    })
                };
            });
        });
    }));
    function playNext() {
        viewModel.nowPlaying(viewModel.playerQueue.shift());
    }
    viewModel.playNext = playNext;
})(viewModel || (viewModel = {}));
;
ko.applyBindings(viewModel);
