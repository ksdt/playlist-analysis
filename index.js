var express = require('express'),
    spinitron = require('spinitron-spinpapi'),
    mustache = require('mustache'),
    fuzzy = require('fuzzy');

var app = express();
spinitron = new spinitron({
                    station: 'ksdt',  /* optional */
                    userid: '',
                    secret: ''
            });

var shows;

app.get('/', function (req, res) {
    spinitron.getRegularShowsInfo({}, function (error, response) {
        shows = response.results;
        var template =
        "<ul>{{#shows}}<li><a href='/show/{{ShowName}}'>{{ShowName}}</a></li>{{/shows}}</ul>";
        res.send(mustache.render(template, {shows: shows}));
    });
});

app.get('/show/:showname', function (req, res) {
    var shownames = Array.from(shows, show => show.ShowName);
    var result = fuzzy.filter(req.params.showname, shownames);
    var show = shows[result[0].index];
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
                                resolve({[playlist.PlaylistID]: resp.results}); /* resolve the promise with the song list! */
                            }
                        });
                    }
                )
            );
        });
        /* once all the promises have resolved... */
        Promise.all(songsFromPlaylists)
            .then((values) => { /* then we have all the shows' played songs! */
                var songs = [];
                values.forEach(function(playlist) {
                    Object.keys(playlist).forEach(function(key) {
                        playlist[key].forEach(function(song) {
                            songs.push(song);
                        });
                    });
                });
                var template =
                "<ul>{{#songs}}<li>{{SongName}} - {{ArtistName}}</li>{{/songs}}</ul>";
                var artistCount = {};
                songs.forEach((song) => {
                    artistCount[song.ArtistName] =
                        artistCount[song.ArtistName] ? artistCount[song.ArtistName] + 1 : 1;
                });
                res.send(artistCount);
            });

    });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
