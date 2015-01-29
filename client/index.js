
var synchronize = function(init, obs) {
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

var searchText = ko.observable('');

var searchResults = synchronize([], ko.computed(function() {
    return !searchText() ? [] : $.get('query?value=' + encodeURIComponent(searchText()))
        .then(function(results) {
            return Object.keys(results).map(function(indexName) {
                var indexHits = results[indexName];
                return {
                    index: indexName,
                    hits: indexHits.map(function(hit) {
                        return {
                            caption: hit.value,
                            imageSource: hit.coverart ? "coverart?name=" + encodeURIComponent(hit.coverart)
                                                    : "missingart.png"
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