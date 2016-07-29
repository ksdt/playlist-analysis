var express = require('express'),
    Mustache = require('mustache');

var shows = require('./show.js'),
    spotify = require('./spotify.js'),
    spinitron = require('./spinitron.js');

var app = express();

app.use(express.static('public'));

var baseTemplate = require('fs').readFileSync('./views/index.mustache', 'utf8');

app.get('/', function (req, res) {
    let showNames = Array.from(spinitron.getShowList(), show => show.ShowName);
    let template = `
        <h4>KSDT Shows</h4>
        <ul>
            {{#shows}}
                <li><a href="/show/{{.}}">{{.}}</a></li>
            {{/shows}}
        </ul>
    `;
    res.send(Mustache.render(template, {
        shows: showNames
    }));
});

app.get('/show/:showname', function (req, res) {
    let _show, _topPlayedArtists, _relatedArtists;
    let numberOfRows = 5;
    /* promise chain, gets show info, then top played artists, then related artists, then renders */
    shows.showFromName(req.params.showname) //grab show info
        .then(show => {
                _show = show; //set variables in higher scope so we can use this info later
                return show.getTopPlayedArtists() //get show's top played
            }, error => console.log(error)
        )
        .then(topPlayedArtists => {
                _topPlayedArtists = topPlayedArtists;
                return Promise.all(
                    topPlayedArtists.slice(0, numberOfRows).map(x =>
                        spotify.getRelatedArtists(x[0]) //get related artists for each top played
                    )
                );
            }, error => console.log(error)
        )
        .then(relatedArtists => {
                _relatedArtists = relatedArtists;
            }, error => console.log(error)
        )
        .then(() => {
                let showTemplate = require('fs').readFileSync('./views/show.mustache', 'utf8');
                let mostRecentPlaylist = require('fs').readFileSync('./views/most-recent-playlist.mustache', 'utf8');

                let mostRecentPlaylistView = (function() {
                    let songs = [];
                    _show.getMostRecentPlayist().Songs.forEach( (song) => {
                        songs.push({
                            time: song['Timestamp'],
                            title: song['SongName'],
                            artist: song['ArtistName']
                        });
                    });
                    return {
                        date: _show.getMostRecentPlayist()['PlaylistDate'],
                        songs: songs
                    }
                })();

                let renderedMostRecentPlaylist = Mustache.render(mostRecentPlaylist, mostRecentPlaylistView);

                let recommendedArtists = require('fs').readFileSync('./views/recommended-artists.mustache', 'utf8');

               /* here we build the data into an array that Mustache can iterate over and
                  generate HTML for */
                let table = [];
                _relatedArtists.forEach( (relatedArtist, index) => {
                    table[index] = {
                        count: _topPlayedArtists[index][1],
                        name: _topPlayedArtists[index][0],
                        relatedArtists:
                            _relatedArtists[index]
                                .slice(0, numberOfRows) //trim related artists
                                .map(x => x.name) //reduce each element to just the name
                                .join(', ') //join with a comma
                    }
                });
                /* generate the Mustache view object, which holds the show name and the artists table */
                let view = {
                   show: _show._name,
                   artists: table
                };

                let renderedRecommendedArtists = Mustache.render(recommendedArtists, view);


                /* ----------------------- top artists : start ------------------------------ */
                let topPlayedArtistsList = require('fs').readFileSync('./views/top-played-artists.mustache', 'utf8');

                let topTable = [];

                _topPlayedArtists.slice(0, 30).forEach( (currentArtist, index) => {
                    topTable[index] = {
                        rank: index,
                        count: currentArtist[1],
                        name: currentArtist[0]
                    }
                });

                let topView = {
                    artists: topTable
                }

                let renderedTopPlayedArtists = Mustache.render(topPlayedArtistsList, topView);


                /* ----------------------- top artists : end ------------------------------ */

                let renderedShowView = Mustache.render(showTemplate, { show: _show._name }, {
                    'recommended-artists': renderedRecommendedArtists,
                    'most-recent-playlist': renderedMostRecentPlaylist,
                    'top-played-artists': renderedTopPlayedArtists
                });

                /* send the request */
                res.send(Mustache.render(baseTemplate, { data: renderedShowView }));
            }, error => { console.log(error); }
        )
        .catch(error => console.log.bind(console));

});

module.exports = app;
