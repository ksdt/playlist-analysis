var web = require('./lib/web'),
    shows = require('./lib/show.js'),
    spotify = require('./lib/spotify.js'),
    spinitron = require('./lib/spinitron.js');

Promise.all([
    spinitron.init(),
    spotify.init()
])
.then(() => {
    web.listen(process.env['PORT'] || 3000, function () {
      console.log('Example app listening on port 3000!');
    });
}, error => console.log(error))
.catch(error => console.log.bind(console));
