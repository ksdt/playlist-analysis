var spotify = {
    _spotifyApi: require('spotify-web-api-node'),
    /* init function will resolve when spotify api is set up */
    init: function () {
        return new Promise((resolve, reject) => {
            /* use environment variables or no credentials, either works,
               although using no credentials will rate limit more aggressively */
            this._spotifyApi = new this._spotifyApi({
                clientId : process.env['SPOT_ID'] || '',
                clientSecret : process.env['SPOT_SECRET'] || ''
            });
            console.log("initalized spotify API");
            resolve();
        });
    },
    /* getRealtedArtists will return related artists from
       a given artist string. To achieve this, we need to chain
       two APIs, first getting the Spotify artist ID from the artist
       search string, and then using the spotify artist ID, look up
       similar artists. */
    getRelatedArtists: function (artistString) {
        return new Promise((resolve, reject) => {
            if (!this._spotifyApi) {
                reject("Spotify API not initalized");
            } else if (!artistString) {
                reject("No search string specified");
            } else {
                this._spotifyApi.searchArtists(artistString)
                    .then((data) => {
                        /* take the first result from the search */
                        let artistSpotifyId = data.body.artists.items[0].id;
                        /* find related artists from id */
                        /* we return a promise so we can chain .then() */
                        return this._spotifyApi.getArtistRelatedArtists(
                            artistSpotifyId
                        );
                    }, (error) => {
                        console.log("Error searchArtists for", artistString);
                        console.log(error);
                        resolve([]);
                    })
                    .then((data) => {
                        if (!data) {
                            resolve([]);
                        } else {
                            resolve(data.body.artists);
                        }
                    }, (error) => {
                        console.log("Error getArtistRelatedArtists");
                        console.log(error);
                        resolve([]);
                    })
                    .catch(error => {
                        console.log.bind(console);
                        resolve([])
                    });
            }
        });
    }
}

module.exports = spotify;
