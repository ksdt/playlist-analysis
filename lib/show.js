var fuzzy = require('fuzzy');

var spinitron = require('./spinitron.js');

var SHOWS_FROM_NAME = {};

class Show {
    constructor(id, djs, name, onair, offair, playlists, description) {
        this._id = id;
        this._djs = djs;
        this._name = name;
        this._onair = onair;
        this._offair = offair;
        this._playlists = playlists;
        this._description = description;
    }
    /* Returns sorted array of the form
       [
            [name, count],
            [name, count]
       ]

       where name is the artist name, and the count is the amount of times
       that artist has appears in the show's playlists.
     */
    getTopPlayedArtists() {
        /* BEING SORTING */
        let artistPlayCount = {};
        /*iterate over each playlist */
        this._playlists.forEach(function (currentPlaylist) {
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

        let artistPlayCountArr = [];
        /* iterate over the key value pairs of the artistPlayCount object,
            forming the array described above */
        Object.keys(artistPlayCount).forEach(function (currentArtist) {
            let pair = [currentArtist, artistPlayCount[currentArtist]];
            artistPlayCountArr.push(pair);
        });
        /* sort the array in descending order based on the play count */
        artistPlayCountArr.sort(function(a,b) {
            return b[1] - a[1];
        });
        /* END SORTING */
        return artistPlayCountArr;
    }

    /* creates a show object from the show's name */
    static showFromName(name) {
        return new Promise((resolve, reject) => {
            if (SHOWS_FROM_NAME[name]) {
                resolve(SHOWS_FROM_NAME[name]);
            } else {
                /* search shows for certain show, fuzzy search */
                let shownames = Array.from(spinitron.getShowList(), show => show.ShowName);
                let result = fuzzy.filter(name, shownames);
                let show = spinitron.getShowList()[result[0].index];
                /* get all playlists for show */
                spinitron._spinitronApi.getPlaylistsInfo({ShowID: show.ShowID, Num: 99}, function(err, resp) {
                    let songsFromPlaylists = [];
                    /* iterate over shows' playlists*/
                    resp.results.forEach((playlist) => {
                        /* add new promise for getting a playlist's songs to the promise list */
                        songsFromPlaylists.push(
                            new Promise( (resolve, reject) => {
                                    spinitron._spinitronApi.getSongs({PlaylistID: playlist.PlaylistID}, function (err, resp) {
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
                            var compiledShow = new Show(
                                show.ShowID,
                                show.ShowUsers,
                                show.ShowName,
                                show.OnairTime,
                                show.OffairTime,
                                values,
                                show.Description
                            );
                            SHOWS_FROM_NAME[compiledShow.ShowName] = compiledShow;
                            resolve(compiledShow);
                        }, error => { console.log(error); })
                        .catch(error => console.log.bind(console));
                });
            }
        });
    }
}

module.exports = Show;
