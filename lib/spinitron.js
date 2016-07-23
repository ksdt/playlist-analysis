var spinitron = {
    _spinitronApi: require('spinitron-spinpapi'),
    _showList : null,
    /* init function will resolve when we have initalized the spinitron api, and
       have pulled the show schedule from spinitron.
    */
    init: function () {
        return new Promise((resolve, reject) => {
            this._spinitronApi = new this._spinitronApi({
                station: process.env['SPIN_STATION'],  /* optional */
                userid: process.env['SPIN_USER'],
                secret: process.env['SPIN_SECRET']
            });
            this._spinitronApi.getRegularShowsInfo({}, function (err, resp) {
                if (err || !resp.success) {
                    reject(err);
                } else {
                    this._showList = resp.results;
                    console.log("Found", this._showList.length, "spinitron shows");
                    resolve();
                }
            });
        });
    },
    getShowList: function() { return _showList; }
}

module.exports = spinitron;
