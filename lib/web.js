var express = require('express'),
    Mustache = require('mustache'),
    SpotifyWebApi = require('spotify-web-api-node');

var spotifyApi = new SpotifyWebApi({
    clientId : '',
    clientSecret : ''
});


var shows = require('./show.js');


var app = express();

var spinitronShowObjects;

shows.init().then((SPINITRON_SHOWS) => {
    console.log("pulled data from spinitron");
    spinitronShowObjects = SPINITRON_SHOWS;
});

app.get('/', function (req, res) {
    var showNames = Array.from(spinitronShowObjects, show => show.ShowName);
    res.send(showNames);

});

app.get('/show/:showname', function (req, res) {
    /* grabs a promise that will fufill with the show's info and spinitron data,
       including playlists and songs. see show.js for implementation */
    var showInfoPromise = shows.showFromName(req.params.showname);
    showInfoPromise.then((show) => { /* when we get the data for the show */
        /* BEING SORTING

           we want the show's most played artists, to do this, we will create an
           object `artistPlayCount` that will store the artists as keys, and play count
           as value. e.g.
           {
             'The Who' : 10,
             'Grimes' : 15
           }

           After, we will convert this object into an Array of the form:
           [['The Who', 10], ['Grimes', 15]]
           and then we will sort the array using the play count as the comparison, so we end up with
           [['Grimes', 15], ['The Who', 10]]
        */
        var artistPlayCount = {};
        /*iterate over each playlist */
        show.playlists.forEach(function (currentPlaylist) {
            /* iterate over each song object in the playlist */
            currentPlaylist.Songs.forEach(function (currentSong) {
                /* if the artist exists in our map, increment their playcount */
                if( artistPlayCount[currentSong.ArtistName] ) {
                    artistPlayCount[currentSong.ArtistName]++;
                } else { /* else init the artist in our map with a playcount of 1. */
                    artistPlayCount[currentSong.ArtistName] = 1;
                }
            });
        });

        var artistPlayCountArr = [];
        /* iterate over the key value pairs of the artistPlayCount object,
            forming the array described above */
        Object.keys(artistPlayCount).forEach(function (currentArtist) {
            var pair = [currentArtist, artistPlayCount[currentArtist]];
            artistPlayCountArr.push(pair);
        });
        /* sort the array in descending order based on the play count */
        artistPlayCountArr.sort(function(a,b) {
            return b[1] - a[1];
        });

        /* END SORTING */

        /* Now, we want to lookup information from the Spotify API on the top
           played artists. Spotify uses an ID system to keep track of unique artists and songs,
           so we first need to find the Spotify ID associated with each of our top played artists.

           Then we will use the Spotify API for finding similar artists given a Spotify ID of an
           artist.

           Finally, we will display this information in a table.
           10 The Who      | similar artists
           8  Etc          | similar artists
           2  Etc          | similar artists

           */

        /* create a list of promises for the ID lookups */
        var spotifyIdLookupPromises = [];
        /* for the top 10 played artists*/
        artistPlayCountArr.slice(0, 10).forEach(function(currentPair) {
            /* push a new promise to the promise array that promises this information */
            spotifyIdLookupPromises.push(
                new Promise((resolve, reject) => {
                    /* part of the information we want to fufill the promise with is
                       the data from the spotify API lookup that searches the artist and
                       returns the spotify ID for that artist. */
                    var searchPromise = spotifyApi.searchArtists(currentPair[0]);
                    /* so we create the Spotify Promise, then wait for it to finish */
                    searchPromise.then((result) => {
                        /* then with it's results, we resolve our original promise with
                           the data from the spotifty request, and the originalPair data
                           which holds the artist name and artist play count for our show */
                        resolve({
                            artistSearch: result,
                            originalPair: currentPair
                        });
                    }, () => reject()); /* if there was an error, we reject the promise */
                })
            );
        });
        /* now we await for all the ID lookups to finish */
        Promise.all(spotifyIdLookupPromises)
            .then( function (resultsArray) {
                /* and for each ID, we need to lookup the similar artists, so we
                   repeat the above behavior, creating a list of promises for the
                   similar artist API lookup. */
                var similarArtistsPromises = [];
                resultsArray.forEach(function(result) {
                    similarArtistsPromises.push(
                        new Promise((resolve, reject) => {
                            /* we create the similar artist API lookup */
                            var similarArtistPromise =
                                spotifyApi.getArtistRelatedArtists(
                                    result.artistSearch.body.artists.items[0]['id']
                                );
                                /* then when it is finished, resolve the original promise
                                   with the following results: the original string -> spotifiy ID API results,
                                   the spotify ID -> similar artist results, and the original Pair which holds
                                   our artist name and artist plays. */
                            similarArtistPromise.then( (similarArtists) => {
                                resolve({
                                    artist: result.artistSearch.body,
                                    similarArtists: similarArtists.body,
                                    originalPair: result.originalPair
                                });
                            }, () => reject()); /* if there was an error, reject the promise */
                        })
                    );
                });
                /* since we are in a .then function of a promise, we can return a promise
                   and chain another .then which awaits the completion of the returned promise */
                return Promise.all(similarArtistsPromises);
            })
            .then( function(resultsArray) {
                /* now, we have all our data, so we use Mustache JS to display the data. */
                var template =
                `top artists and similar artists for {{show}}
                <table>
                    <thead>
                    <tr>
                        <td>Play Count</td>
                        <td>Artist Name</td>
                        <td>Similar Artists</td>
                    </tr>
                    </thead>
                {{#artists}}
                    <tr>
                        <td>{{count}}</td>
                        <td>{{name}}</td>
                        <td>{{relatedArtists}}</td>
                    </tr>
                {{/artists}}
                </table>`;
                /* here we build the data into an array that Mustache can iterate over and
                   generate HTML for */
                var artists = [];
                resultsArray.forEach(function (result) {
                    var artistName = result.artist.artists.items[0].name;
                    var related = "";
                    /* display only the first 5 similar artists */
                    result.similarArtists.artists.slice(0, 5).forEach(function (artist) {
                        related += artist.name + ', ';
                    });
                    /* trim off the excess comma and space at the end of the related artist string */
                    related = related.substring(0, related.length - 2);
                    /* add the final object to the Mustache array to be displayed */
                    artists.push({
                        count: result.originalPair[1],
                        name: artistName,
                        relatedArtists: related
                    })
                });
                /* generate the Mustache view object, which holds the show name and the artists table */
                var view = {
                    show : show.name,
                    artists: artists
                };
                /* send the request */
                res.send(Mustache.render(template, view));

            });
    }, err => { console.log(err); res.sendStatus(500); } );
});

module.exports = app;
