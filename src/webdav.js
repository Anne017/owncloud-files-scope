//This is a 'fork' of the webdav-fs module's client code (https://github.com/perry-mitchell/webdav-fs/blob/master/source/client.js)

var utils = require('./utils');

var fetch = require('node-fetch');
var xml2js = require('xml2js');
var querystring = require('querystring');
var pathTools = require('path');

var Bro = require('brototype');
var __iCanHaz = Bro.prototype.iCanHaz;

Bro.prototype.iCanHaz1 = function() {
    var keys = Array.prototype.slice.call(arguments),
        val,
        keysLen = keys.length;

    for (var i = 0; i < keysLen; i += 1) {
        val = __iCanHaz.call(this, keys[i]);
        if (val !== undefined) {
            return val;
        }
    }

    return undefined;
};

function processDirectoryResult(path, dirResult, targetOnly) {
    var items = [],
        responseItems = [],
        dirResultBro = Bro(dirResult);
    if (targetOnly === undefined) {
        targetOnly = false;
    }
    try {
        var multistatus = dirResultBro.iCanHaz1('d:multistatus', 'D:multistatus');
        responseItems = Bro(multistatus).iCanHaz1('d:response', 'D:response') || [];
    } catch (e) {}
    responseItems.forEach(function(responseItem) {
        var responseBro = Bro(responseItem),
            propstatBro = Bro(responseBro.iCanHaz1('d:propstat.0', 'D:propstat.0')),
            props = propstatBro.iCanHaz1('d:prop.0', 'D:prop.0'),
            propsBro = Bro(props);

        var filename = processDirectoryResultFilename(
                path,
                processXMLStringValue(responseBro.iCanHaz1('d:href', 'D:href'))
            ),
            resourceType = processXMLStringValue(propsBro.iCanHaz1('d:resourcetype', 'D:resourcetype')),
            itemType = (resourceType.indexOf('d:collection') >= 0 || resourceType.indexOf('D:collection') >= 0) ?
                'directory' : 'file';
        if (filename.length <= 0) {
            return;
        }
        if ((targetOnly && filename !== path) || (!targetOnly && filename === path)) {
            // skip self or only self
            return;
        }
        filename = querystring.unescape('/' + filename);
        var item = {
                filename: filename,
                basename: pathTools.basename(filename),
                lastmod: processXMLStringValue(propsBro.iCanHaz1('d:getlastmodified', 'D:getlastmodified')),
                size: parseInt(processXMLStringValue(propsBro.iCanHaz1('d:getcontentlength', 'D:getcontentlength')) || '0', 10),
                type: itemType
            },
            mime = propsBro.iCanHaz1('d:getcontenttype', 'D:getcontenttype');
        if (mime) {
            item.mime = mime;
        }
        items.push(item);
    })
    return items;
}

function processDirectoryResultFilename(path, resultFilename) {
    path = decodeURIComponent(path);
    resultFilename = decodeURIComponent(resultFilename);

    var resultFLen = resultFilename.length;
    if (resultFilename[resultFLen - 1] === '/') {
        resultFilename = resultFilename.substr(0, resultFLen - 1);
    }
    if (path === '/' || path === '') {
        var resultParts = resultFilename.split('/');
        return resultParts[resultParts.length - 1];
    }
    var pos = resultFilename.indexOf(path);
    if (pos >= 0) {
        return resultFilename.substr(pos);
    }
    return '';
}

function processXMLStringValue(xmlVal) {
    if (Array.isArray(xmlVal)) {
        if (xmlVal.length === 1) {
            return (xmlVal.length === 1 && typeof xmlVal[0] === 'string') ? xmlVal[0] : JSON.stringify(xmlVal);
        } else {
            return JSON.stringify(xmlVal);
        }
    } else if (typeof xmlVal === 'string') {
        return xmlVal;
    }
    return '';
}

module.exports = {
    getDir: function(auth, path) {
        path = utils.sanitize_path(path);
        if (path.length <= 0) {
            path = '/';
        }

        return fetch(auth.url + path, {
            method: 'PROPFIND',
            headers: {
                Depth: 1
            }
        })
        .then(function(res) {
            if (res.status == 401) {
                throw {
                    name: 'Unauthorized',
                    message: 'You do not have access to this service',
                    code: 401,
                    response: res,
                }
            }
            else if (res.status == 403) {
                throw {
                    name: 'Forbidden',
                    message: 'You are not allowed to access this',
                    code: 403,
                    response: res,
                }
            }
            else if (res.status == 404) {
                throw {
                    name: 'Not Found',
                    message: 'The folder you are trying to access does not exist',
                    code: 404,
                    response: res,
                }
            }
            else if (res.status < 200 || res.status > 299) {
                utils.warn('Non-OK response (' + res.status + '): ' + JSON.stringify(res));
            }

            return res.text();
        })
        .then(function(body) {
            var parser = new xml2js.Parser();
            return new Promise(function(resolve, reject) {
                parser.parseString(body, function(err, result) {
                    if (err) {
                        (reject)(err);
                    } else {
                        (resolve)(processDirectoryResult(path, result));
                    }
                });
            });
        });
    },
};
