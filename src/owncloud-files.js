var moment = require('moment');
var path = require('path');
var webdav = require('webdav-fs/source/client');
var scopes = require('unity-js-scopes');
var scope = scopes.self; //convenience

var text_files = ['.txt', '.rst', '.md', '.csv', '.ini'];
var doc_files = ['.doc', '.docx', '.rtf', '.odt'];
var image_files = ['.jpg', '.jpeg', '.jfif', '.exif', '.tiff', '.gif', '.bmp', '.png', '.ppm', '.pgm', '.pbm', '.pnm', '.webp', '.svg', '.ai'];
var video_files = ['.webm', '.mkv', '.flv', '.vob', '.ogv', '.gifv', '.avi', '.mov', '.wmv', '.mp4', '.m4p', '.m4v', '.mpg', '.mp2', '.mpeg', '.mpe', '.mpv', '.m2v', '.m4v', '.3gp', '.3g2'];
var audio_files = ['.wav', '.flac', '.m4a', '.wma', '.ast', '.aac', '.ogg', '.mp3'];
var archive_files = ['.7z', '.bz2', '.deb', '.click', '.rpm', '.gz', '.bz', '.lz', '.tar', '.tgz', '.ar', '.iso', '.lzma', '.xz'];
var pdf_files = ['.pdf'];
var code_files = ['.js', '.c', '.cpp', '.h', '.hpp', '.java', '.php', '.html', '.css', '.less', '.scss', 'xml', '.xhtml', '.node', '.py', '.go', '.lisp', '.m', '.pl', '.r', '.rb', '.cs', '.swift', '.sql', '.sh'];
var powerpoint_files = ['.ppt', '.pptx', '.odp'];
var spreadsheet_files = ['.xls', '.xlsx', '.ods'];

var TEMPLATE = {
    'schema-version': 1,
    'template': {
        'category-layout': 'grid',
        'card-size': 'small',
    },
    'components': {
        'title': 'title',
        'art' : {
            'field': 'art',
        },
    },
};

var ERROR_TEMPLATE = {
    'schema-version': 1,
    'template': {
        'category-layout': 'grid',
        'card-size': 'medium',
    },
    'components': {
        'title': 'title',
        'art' : {
            'field': 'art',
        },
        'subtitle': 'subtitle',
    },
};

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

function error_result(search_reply, id, title, subtitle, error_message, category_title) {
    category_title = category_title ? category_title : 'error';
    var category_id = category_title.replace(' ', '-').toLowerCase();

    var category_renderer = new scopes.lib.CategoryRenderer(JSON.stringify(ERROR_TEMPLATE));
    var category = search_reply.register_category(category_id, category_title, '', category_renderer);

    var result = new scopes.lib.CategorisedResult(category);
    result.set_uri(id);
    result.set_title(title);
    result.set('subtitle', subtitle ? subtitle : '');
    result.set('error', true);
    result.set_art(path.join(scope.scope_directory, 'error.svg'));

    if (error_message) {
        result.set('message', error_message);
    }

    return result;
}

var connection = null;
var scope_id = null;
var endpoint = {
    url: '',
    username: '',
    password: '',
};

function setup_endpoint() {
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
    var accessURL = (username.length > 0) ? url.replace(/(https?:\/\/)/i, "$1" + username + ":" + password + "@") : url;
    if (accessURL[accessURL.length - 1] !== '/') {
        accessURL += '/';
    }

    endpoint = {
        url: accessURL,
        username: username,
        password: password
    };
}

scope.initialize(
    {}, //options
    {
        run: function scope_run() {
            console.log('owncloud file scope running');
        },
        start: function scope_start(id) {
            console.log('owncloud file scope starting up', id);
            scope_id = id;
        },
        search: function scope_search(canned_query, metadata) {
            setup_endpoint();

            return new scopes.lib.SearchQuery(
                canned_query,
                metadata,
                function query_run(search_reply) { //TODO departments based on file types (do this after mimetype checking)
                    var qs = canned_query.query_string();
                    console.log('search', qs);

                    if (endpoint.url) {
                        var category_renderer = new scopes.lib.CategoryRenderer(JSON.stringify(TEMPLATE));
                        var file_category = search_reply.register_category('files', 'Files', '', category_renderer);
                        var folder_category = search_reply.register_category('folders', 'Folders', '', category_renderer);

                        var dir = qs || '/';
                        if (dir.charAt(0) != '/') {
                            dir = '/' + dir;
                        }

                        if (dir != '/') {
                            var parent = path.normalize(path.join(dir, '..'));

                            var parent_result = new scopes.lib.CategorisedResult(folder_category);
                            parent_result.set_uri('scope://owncloud-files-scope.bhdouglass_owncloud-files?q=' + parent);
                            parent_result.set_title('Parent Folder');
                            parent_result.set('file', false);
                            parent_result.set('path', parent);
                            parent_result.set_intercept_activation();
                            parent_result.set_art(path.join(scope.scope_directory, 'parent.png'));

                            search_reply.push(parent_result);
                        }

                        webdav.getDir(endpoint, dir).then(function(contents, b) {
                            var contents = contents.sort(function(a, b) {
                                if (a.type == 'file' && b.type == 'folder') {
                                    return -1;
                                }
                                else if (a.type == 'folder' && b.type == 'file') {
                                    return 1;
                                }
                                else if (a.filename < b.filename) {
                                    return -1;
                                }
                                else if (a.filename > b.filename) {
                                    return 1;
                                }

                                return 0;
                            }).filter(function(file) {
                                //Remove potentially problamatic entries
                                return (['/webdav', dir, '.', '..', null, ''].indexOf(file.filename) == -1);
                            });

                            if (contents.length === 0) {
                                search_reply.push(error_result(search_reply, 'empty-folder', 'This folder is empty', dir, '', 'Empty Folder'));
                                search_reply.finished();
                            }
                            else {
                                for (var index in contents) {
                                    var file = contents[index];

                                    if (file) {
                                        if (file.type == 'file') {
                                            var file_result = new scopes.lib.CategorisedResult(file_category);
                                            file_result.set_uri(file.filename);
                                            file_result.set_title(path.basename(file.filename));
                                            file_result.set('file', true);
                                            file_result.set('path', file.filename);
                                            file_result.set('mtime', moment(new Date(file.lastmod)).fromNow());
                                            file_result.set('size', nice_bytes(file.size));
                                            file_result.set('mime', JSON.stringify(file.mime));

                                            var ext = path.extname(file.filename);
                                            //TODO do this checking based on mimetype
                                            if (text_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_text.png'));
                                            }
                                            else if (doc_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_doc.png'));
                                            }
                                            else if (image_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_image.png'));
                                            }
                                            else if (video_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_movie.png'));
                                            }
                                            else if (audio_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_sound.png'));
                                            }
                                            else if (archive_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_zip.png'));
                                            }
                                            else if (pdf_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_pdf.png'));
                                            }
                                            else if (code_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_code.png'));
                                            }
                                            else if (powerpoint_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_ppt.png'));
                                            }
                                            else if (spreadsheet_files.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_xls.png'));
                                            }
                                            else {
                                                file_result.set_art(path.join(scope.scope_directory, 'file.png'));
                                            }

                                            search_reply.push(file_result);
                                        }
                                        else {
                                            var folder_result = new scopes.lib.CategorisedResult(folder_category);
                                            folder_result.set_uri('scope://owncloud-files-scope.bhdouglass_owncloud-files?q=' + file.filename);
                                            folder_result.set_title(path.basename(file.filename));
                                            folder_result.set('file', false);
                                            folder_result.set('path', file.filename);
                                            folder_result.set('mtime', moment(new Date(file.lastmod)).fromNow());
                                            folder_result.set_intercept_activation();
                                            folder_result.set_art(path.join(scope.scope_directory, 'folder.png'));

                                            search_reply.push(folder_result);
                                        }
                                    }
                                }

                                console.log('finished searching');
                                search_reply.finished();
                            }
                        })
                        .catch(function(err) {
                            console.warn('error reading dir', qs, err.message);

                            search_reply.push(error_result(search_reply, 'list-error', 'Error reading folder', dir, err.message));
                            search_reply.finished();
                        });
                    }
                    else { //No connection put an error result
                        search_reply.push(error_result(search_reply, 'no-connection', 'No connection to ownCloud', 'Check the scope settings'));
                        search_reply.finished();
                    }
                },
                function query_cancelled() {}
            );
        },
        preview: function scope_preview(result, action_metadata) {
            return new scopes.lib.PreviewQuery(
                result,
                action_metadata,
                function preview_run(preview_reply) {
                    if (result.get('error')) {
                        var error_image = new scopes.lib.PreviewWidget('image', 'image');
                        error_image.add_attribute_mapping('source', 'art');

                        var error_header = new scopes.lib.PreviewWidget('header', 'header');
                        error_header.add_attribute_mapping('title', 'title');
                        error_header.add_attribute_mapping('subtitle', 'subtitle');

                        var message = new scopes.lib.PreviewWidget('message', 'text');
                        message.add_attribute_value('text', result.get('message'));

                        preview_reply.push([error_image, error_header, message]);
                    }
                    else {
                        var image = new scopes.lib.PreviewWidget('image', 'image');
                        image.add_attribute_mapping('source', 'art');

                        var header = new scopes.lib.PreviewWidget('header', 'header');
                        header.add_attribute_mapping('title', 'title');
                        header.add_attribute_value('subtitle', path.dirname(result.get('path')));

                        var mtime = new scopes.lib.PreviewWidget('mtime', 'text');
                        mtime.add_attribute_value('text', 'Last Modified: ' + result.get('mtime'));

                        preview_reply.push([image, header, mtime]);

                        if (result.get('size')) {
                            var size = new scopes.lib.PreviewWidget('size', 'text');
                            size.add_attribute_value('text', 'File Size: ' + result.get('size'));

                            preview_reply.push([size]);
                        }

                        if (result.get('file')) {
                            var urlpath = endpoint.url;
                            if (urlpath[urlpath.length - 1] === '/') {
                                urlpath = urlpath.substring(0, urlpath.length - 1);
                            }
                            urlpath += result.get('path');

                            var download = new scopes.lib.PreviewWidget('actions', 'actions');
                            download.add_attribute_value('actions',[
                                {
                                    id: 'download',
                                    label: 'Download',
                                    uri: urlpath,
                                }
                            ]);

                            preview_reply.push([download]);
                        }
                    }

                    preview_reply.finished();
                },
                function preview_cancelled() {}
            );
        },
        activate: function(result, metadata) {
            //Force the url dispatcher to take care of things
            console.log('activate');

            return new scopes.lib.ActivationQuery(
                result,
                metadata,
                '',
                '',
                function activate_run() {
                    return new scopes.lib.ActivationResponse(
                        scopes.defs.ActivationResponseStatus.NotHandled
                        //new scopes.lib.CannedQuery(scope_id, result.get('path'), '')
                    );
                },
                function activate_cancelled() {}
            );
        },
        perform_action: function(result, metadata, widget_id, action_id) {
            //Force the url dispatcher to take care of things
            console.log('perform action', widget_id, action_id);

            return new scopes.lib.ActivationQuery(
                result,
                metadata,
                widget_id,
                action_id,
                function perform_action_run() {
                    return new scopes.lib.ActivationResponse(scopes.defs.ActivationResponseStatus.NotHandled);
                },
                function perform_action_cancelled() {}
            );
        }
    }
);
