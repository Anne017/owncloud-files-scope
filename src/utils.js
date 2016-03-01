function nice_bytes(bytes) {
    var unit = 'B';

    if (!bytes) {
        bytes = 0;
    }
    else if (bytes > 1024) {
        bytes /= 1024;
        unit = 'KB';

        if (bytes > 1024) {
            bytes /= 1024;
            unit = 'MB';

            if (bytes > 1024) {
                bytes /= 1024;
                unit = 'GB';

                if (bytes > 1024) {
                    bytes /= 1024;
                    unit = 'TB';
                }
            }
        }
    }

    return bytes.toFixed(1) + ' ' + unit;
}

function setup_endpoint(scope) {
    var url = scope.settings.url ? scope.settings.url.get_string() : '';
    if (url) {
        if (url.toLowerCase().indexOf('http://') !== 0 && url.toLowerCase().indexOf('https://') !== 0) {
            url = 'http://' + url;
        }

        if (url.indexOf('/remote.php/webdav') == -1) {
            if (url[url.length - 1] === '/') {
                url = url.substring(0, url.length - 1);
            }

            url += '/remote.php/webdav';
        }
    }

    var username = scope.settings.username ? scope.settings.username.get_string() : '';
    var password = scope.settings.password ? scope.settings.password.get_string() : '';

    //Borrowed from https://github.com/perry-mitchell/webdav-fs/blob/master/source/index.js#L22
    var access_url = (username.length > 0) ? url.replace(/(https?:\/\/)/i, "$1" + encodeURIComponent(username) + ":" + encodeURIComponent(password) + "@") : url;
    if (access_url[access_url.length - 1] !== '/') {
        access_url += '/';
    }

    console.log(access_url);

    return {
        url: access_url,
        username: username,
        password: password
    };
}

function log(message) {
    console.log('ownCloud-files-scope.bhdouglass LOG:', message);
}

function warn(message) {
    console.log('ownCloud-files-scope.bhdouglass WARN:', message);
}

function error(message) {
    console.log('ownCloud-files-scope.bhdouglass ERROR:', message);
}

module.exports = {
    nice_bytes: nice_bytes,
    setup_endpoint: setup_endpoint,
    log: log,
    warn: warn,
    error: error,
};