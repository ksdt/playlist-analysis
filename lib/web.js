var express = require('express'),
    Mustache = require('mustache');

var shows = require('./show.js'),
    spotify = require('./spotify.js'),
    spinitron = require('./spinitron.js');

var app = express();

app.get('/', function (req, res) {
    let showNames = Array.from(spinitron.getShowList(), show => show.ShowName);
    let template = `
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
    /* grabs a promise that will fufill with the show's info and spinitron data,
       including playlists and songs. see show.js for implementation */
    let _show, _topPlayedArtists, _relatedArtists;
    let numberOfRows = 5;
    shows.showFromName(req.params.showname)
        .then(show => {
            _show = show;
            return show.getTopPlayedArtists()
        }, error => console.log(error))
        .then(topPlayedArtists => {
            _topPlayedArtists = topPlayedArtists;
            return Promise.all(
                topPlayedArtists.slice(0, numberOfRows).map(x =>
                    spotify.getRelatedArtists(x[0])
                )
            );
        }, error => console.log(error))
        .then(relatedArtists => {
            _relatedArtists = relatedArtists;
        }, error => console.log(error))
        .then(() => {
            let template =
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
            let table = [];
            _relatedArtists.forEach( (relatedArtist, index) => {
                table[index] = {
                    count: _topPlayedArtists[index][1],
                    name: _topPlayedArtists[index][0],
                    relatedArtists:
                        _relatedArtists[index]
                            .slice(0, numberOfRows)
                            .map(x => x.name)
                            .join(', ')
                }
            });
            /* generate the Mustache view object, which holds the show name and the artists table */
            let view = {
               show: _show._name,
               artists: table
            };
            /* send the request */
            res.send(Mustache.render(template, view));
        }, error => { console.log(error); })
        .catch(error => console.log.bind(console));

});

module.exports = app;
