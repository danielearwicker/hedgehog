
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

var searchText = ko.observable("");

function addressChange() {
    searchText(decodeURIComponent(window.location.hash.substr(1)));
}

window.addEventListener("hashchange", addressChange, false);

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
                            : indexName + "|" + encodeURIComponent(hit.value))
                    };
                })
            };
        });
    });
}).extend({ throttle: 200 }));

var viewModel = {
    searchText: searchText,
    searchResults: searchResults
};

ko.applyBindings(viewModel);