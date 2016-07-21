var spinitron = require('spinitron-spinpapi'),
    fuzzy = require('fuzzy');

spinitron = new spinitron({
                    station: 'ksdt',  /* optional */
                    userid: '',
                    secret: ''
            });


function showObject(id, djs, name, onair, offair, playlists, description) {
    this.id = id;
    this.djs = djs;
    this.name = name;
    this.onair = onair;
    this.offair = offair;
    this.playlists = playlists;
    this.description = description;
}

var CACHED_SHOWS = {};


var SPINITRON_SHOWS;
/* populate list of existing shows */
function init() {
    return new Promise((resolve, reject) => {
        spinitron.getRegularShowsInfo({}, function (err, resp) {
            if (err || !resp.success) {
                console.log("error getting shows from spinitron", err);
                reject();
            } else {
                SPINITRON_SHOWS = resp.results;
                resolve(SPINITRON_SHOWS);
            }
        });
    });
}


function showFromName(name) {
    var p = new Promise((resolve, reject) => {
        if (CACHED_SHOWS[name]) {
            resolve(CACHED_SHOWS[name]);
        } else {
            var shownames = Array.from(SPINITRON_SHOWS, show => show.ShowName);
            var result = fuzzy.filter(name, shownames);
            var show = SPINITRON_SHOWS[result[0].index];
            /* get all playlists for show */
            spinitron.getPlaylistsInfo({ShowID: show.ShowID, Num: 99}, function(err, resp) {
                var songsFromPlaylists = [];
                /* iterate over shows' playlists*/
                resp.results.forEach(function(playlist) {
                    /* add new promise for getting a playlist's songs to the promise list */
                    songsFromPlaylists.push(
                        new Promise( /* create a new promise for getting playlists' songs */
                            function (resolve, reject) {
                                spinitron.getSongs({PlaylistID: playlist.PlaylistID}, function (err, resp) {
                                    if (err) {
                                        reject(); /* reject because the web request failed */
                                    } else {
                                        playlist.Songs = resp.results;
                                        resolve(playlist); /* resolve the promise with the song list! */
                                    }
                                });
                            }
                        )
                    );
                });
                /* once all the promises have resolved... */
                Promise.all(songsFromPlaylists)
                    .then((values) => { /* then we have all the shows' played songs! */
                        var compiledShow = new showObject(
                            show.ShowID,
                            show.ShowUsers,
                            show.ShowName,
                            show.OnairTime,
                            show.OffairTime,
                            values,
                            show.Description
                        );
                        CACHED_SHOWS[compiledShow.ShowName] = compiledShow;
                        resolve(compiledShow);
                    }, (errs) => { console.log(errs); });
            });
        }
    });
    return p;

}

module.exports.shows = CACHED_SHOWS;
module.exports.showFromName = showFromName;
module.exports.init = init;
