var utils = require('./utils');
var translations = require('./translations');
var _ = translations._;

var fetch = require('node-fetch');
var xml2js = require('xml2js');
var nutil = require('util');
var path = require('path');

function MalformedResponseError() {
    Error.call(this);
    this.message = _('Unrecognizable response from the server');
}

nutil.inherits(MalformedResponseError, Error);

function UnauthorizedError() {
    Error.call(this);
    this.message = _('You do not have access to this service');
    this.code = 401;
}

nutil.inherits(UnauthorizedError, Error);

function ForbiddenError() {
    Error.call(this);
    this.message = _('You are not allowed to access this');
    this.code = 403;
}

nutil.inherits(ForbiddenError, Error);

function NotFoundError() {
    Error.call(this);
    this.message = _('The folder you are trying to access does not exist');
    this.code = 404;
}

nutil.inherits(NotFoundError, Error);

function File(filepath, lastmod, size, mimetype) {
    this.type = 'file';
    this.path = decodeURIComponent(filepath);
    this.basename = path.basename(this.path);
    this.ext = path.extname(this.path);
    this.lastmod = lastmod;
    this.size = size ? parseInt(size) : 0;
    this.mimetype = mimetype;
}

function Folder(folderpath, lastmod, size) {
    this.type = 'folder';
    this.path = decodeURIComponent(folderpath);
    this.basename = path.basename(this.path);
    this.lastmod = lastmod;
    this.size = size ? parseInt(size) : 0;
}

function basic(auth) {
    return auth = 'Basic ' + new Buffer(auth.username + ':' + auth.password).toString('base64');
}

module.exports = {
    getDir: function(auth, remote_path) {
        remote_path = utils.sanitize_path(remote_path);
        if (remote_path.length <= 0) {
            remote_path = '/';
        }

        return fetch(auth.url + remote_path, {
            method: 'PROPFIND',
            headers: {
                Depth: 1,
                Authorization: basic(auth),
            }
        }).then(function(res) {
            if (res.status == 401) {
                throw new UnauthorizedError();
            }
            else if (res.status == 403) {
                throw new ForbiddenError();
            }
            else if (res.status == 404) {
                throw new NotFoundError();
            }
            else if (res.status < 200 || res.status > 299) {
                utils.warn('Non-OK response (' + res.status + '): ' + JSON.stringify(res));
            }

            return res.text();
        })
        .then(function(body) {
            var parser = new xml2js.Parser({normalizeTags: true, explicitArray: false});
            return new Promise(function(resolve, reject) {
                parser.parseString(body, function(err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        if (result && result['d:multistatus'] && result['d:multistatus']['d:response']) {
                            var dir = [];

                            for (var index in result['d:multistatus']['d:response']) {
                                var response_item = result['d:multistatus']['d:response'][index];

                                if (response_item && response_item['d:propstat'] && response_item['d:propstat']['d:prop']) {
                                    var props = response_item['d:propstat']['d:prop'];
                                    var filepath = response_item['d:href'] ? response_item['d:href'].replace('/remote.php/webdav', '') : '';

                                    var check_remote_path = decodeURIComponent(remote_path);
                                    var check_path = decodeURIComponent(filepath);

                                    if (['/webdav', check_remote_path, '/' + check_remote_path, '.', '..', null, ''].indexOf(check_path) == -1) { //Skip over potentially problamatic names
                                        var item = null;
                                        if (props && props['d:resourcetype'] && props['d:resourcetype'] && props['d:resourcetype']['d:collection'] === '') {
                                            item = new Folder(filepath, props['d:getlastmodified'], props['d:quota-used-bytes']);
                                        }
                                        else {
                                            item = new File(filepath, props['d:getlastmodified'], props['d:getcontentlength'], props['d:getcontenttype']);
                                        }

                                        dir.push(item);
                                    }
                                }
                            }

                            //Sort folders to be at the top
                            dir = dir.sort(function(a, b) {
                                if (a.type == 'file' && b.type == 'folder') {
                                    return 1;
                                }
                                else if (a.type == 'folder' && b.type == 'file') {
                                    return -1;
                                }
                                else if (a.filename < b.filename) {
                                    return -1;
                                }
                                else if (a.filename > b.filename) {
                                    return 1;
                                }

                                return 0;
                            })

                            resolve(dir);
                        }
                        else {
                            reject(new MalformedResponseError());
                        }
                    }
                });
            });
        });
    }
};
