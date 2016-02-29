var async = require('async');
var moment = require('moment');
var path = require('path');
var webdavfs = require('webdav-fs');
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
scope.initialize(
    {}, //options
    {
        run: function scope_run() {
            //TODO check for settings change in search function
            var url = scope.settings.url ? scope.settings.url.get_string() : null;
            if (url) {
                if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
                    url = 'http://' + url;
                }
            }

            var username = scope.settings.username ? scope.settings.username.get_string() : null;
            var password = scope.settings.password ? scope.settings.password.get_string() : null;

            if (url && username && password) {
                connection = webdavfs(url, username, password);
            }
            else {
                console.warn('no connection info');
            }
        },
        start: function scope_start(id) {
            console.log('owncloud file scope starting up', id);
            scope_id = id;
        },
        search: function scope_search(canned_query, metadata) {
            return new scopes.lib.SearchQuery(
                canned_query,
                metadata,
                function query_run(search_reply) {
                    var qs = canned_query.query_string();
                    console.log('search', qs);

                    if (connection) {
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

                        connection.readdir(dir, function(err, contents) {
                            if (err) {
                                console.warn('error reading dir', qs, err.message);

                                search_reply.push(error_result(search_reply, 'list-error', 'Error reading folder', dir, err.message));
                                search_reply.finished();
                            }
                            else {
                                var paths = contents.sort().map(function(file) {
                                    return path.join(dir, file);
                                }).filter(function(file) {
                                    //Remove potentially problamatic entries
                                    return (['/webdav', dir, '.', '..', null, ''].indexOf(file) == -1);
                                });

                                if (paths.length === 0) {
                                    search_reply.push(error_result(search_reply, 'empty-folder', 'This folder is empty', dir, '', 'Empty Folder'));
                                    search_reply.finished();
                                }
                                else {
                                    //TODO see if we can get this from usings the webdav-fs client (with the dir read) - https://github.com/perry-mitchell/webdav-fs/blob/master/source/client.js#L119
                                    async.map(paths, function(path, callback) {
                                        connection.stat(path, function(err, stat) {
                                            if (err) { //TODO make this a success then put an error result in the results
                                                console.warn('error stating file', path, err);
                                            }

                                            callback(err, {
                                                path: path,
                                                stat: stat,
                                            });
                                        });
                                    },
                                    function(err, results) {
                                        if (err) {
                                            console.warn('error stating files', err);

                                            search_reply.push(error_result(search_reply, 'stat-error', 'Error listing files', '', err.message));
                                            search_reply.finished();
                                        }
                                        else {
                                            //Loop over folders first for consistency
                                            for (var index in results) {
                                                var file = results[index];

                                                if (file && file.stat && !file.stat.isFile()) {
                                                    var folder_result = new scopes.lib.CategorisedResult(folder_category);
                                                    folder_result.set_uri('scope://owncloud-files-scope.bhdouglass_owncloud-files?q=' + file.path);
                                                    folder_result.set_title(path.basename(file.path));
                                                    folder_result.set('file', false);
                                                    folder_result.set('path', file.path);
                                                    folder_result.set('mtime', moment(file.stat.mtime).fromNow());
                                                    folder_result.set_intercept_activation();
                                                    folder_result.set_art(path.join(scope.scope_directory, 'folder.png'));

                                                    search_reply.push(folder_result);
                                                }
                                            }

                                            for (var index in results) {
                                                var file = results[index];

                                                if (file && file.stat && file.stat.isFile()) {
                                                    var file_result = new scopes.lib.CategorisedResult(file_category);
                                                    file_result.set_uri(file.path);
                                                    file_result.set_title(path.basename(file.path));
                                                    file_result.set('file', true);
                                                    file_result.set('path', file.path);
                                                    file_result.set('mtime', moment(file.stat.mtime).fromNow());

                                                    var ext = path.extname(file.path);
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
                                                    else if (ppt_files.indexOf(ext) >= 0) {
                                                        file_result.set_art(path.join(scope.scope_directory, 'file_ppt.png'));
                                                    }
                                                    else if (code_xls.indexOf(ext) >= 0) {
                                                        file_result.set_art(path.join(scope.scope_directory, 'file_xls.png'));
                                                    }
                                                    else {
                                                        file_result.set_art(path.join(scope.scope_directory, 'file.png'));
                                                    }

                                                    search_reply.push(file_result);
                                                }
                                            }
                                        }

                                        console.log('finished searching');
                                        search_reply.finished();
                                    });
                                }
                            }
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

                        //TODO download button (just a url)

                        preview_reply.push([image, header, mtime]);
                    }

                    preview_reply.finished();
                },
                function preview_cancelled() {}
            );
        },
        activate: function(result, metadata) {
            console.log('activate');

            return new scopes.lib.ActivationQuery(
                result,
                metadata,
                '',
                '',
                function activate_run() {
                    console.log('Activate called');

                    return new scopes.lib.ActivationResponse(
                        scopes.defs.ActivationResponseStatus.NotHandled
                        //new scopes.lib.CannedQuery(scope_id, result.get('path'), '')
                    );
                },
                function activate_cancelled() {}
            );
        }
    }
);
