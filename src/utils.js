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

    //Compensate for scope bug: https://bugs.launchpad.net/ubuntu/+source/unity-api/+bug/1552082
    if (username[0] === '"' && username[username.length - 1] === '"') {
        username = username.slice(1, username.length - 1);
    }

    if (password[0] === '"' && password[password.length - 1] === '"') {
        password = password.slice(1, password.length - 1);
    }

    //Borrowed from https://github.com/perry-mitchell/webdav-fs/blob/master/source/index.js#L22
    var external_url = (username.length > 0) ? url.replace(/(https?:\/\/)/i, "$1" + encodeURIComponent(username) + ":" + encodeURIComponent(password) + "@") : url;
    if (external_url[external_url.length - 1] !== '/') {
        external_url += '/';
    }

    if (url[url.length - 1] !== '/') {
        url += '/';
    }

    return {
        url: url,
        external_url: external_url,
        username: username,
        password: password
    };
}

function sanitize_path(path) {
    var parts = path.split('/');
    path = '';
    for (var index in parts) {
        if (path.length > 0) {
            path += '/';
        }

        path += encodeURIComponent(parts[index]);
    }

    if (path[path.length - 1] !== '/') {
        path += '/';
    }

    return path;
}

function download_link(base, path) {
    var url = base;
    if (url[url.length - 1] === '/') {
        url = url.substring(0, url.length - 1);
    }

    return url + path;
}

//Borrowed from http://stackoverflow.com/a/6274381
function shuffle(a) {
    console.log('shuffle');
    var j, x, i;
    for (i = a.length; i; i -= 1) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
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
    sanitize_path: sanitize_path,
    download_link: download_link,
    shuffle: shuffle,
    log: log,
    warn: warn,
    error: error,
};
