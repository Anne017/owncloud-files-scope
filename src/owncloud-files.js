var moment = require('moment');
var path = require('path');
var webdav = require('./webdav');
var utils = require('./utils');
var filetypes = require('./filetypes');
var scopes = require('unity-js-scopes');
var scope = scopes.self; //convenience

var TEMPLATE = JSON.stringify({
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
});

var ERROR_TEMPLATE = JSON.stringify({
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
});

function error_result(search_reply, id, title, subtitle, error_message, category_title) {
    category_title = category_title ? category_title : 'error';
    var category_id = category_title.replace(' ', '-').toLowerCase();

    var category_renderer = new scopes.lib.CategoryRenderer(ERROR_TEMPLATE);
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

scope.initialize(
    {}, //options
    {
        run: function scope_run() {
            utils.log('running');
        },
        start: function scope_start(id) {
            utils.log('starting (' + id + ')');
            scope_id = id;
        },
        search: function scope_search(canned_query, metadata) {
            endpoint = utils.setup_endpoint(scope);

            return new scopes.lib.SearchQuery(
                canned_query,
                metadata,
                function query_run(search_reply) { //TODO departments based on file types (do this after mimetype checking)
                    var qs = canned_query.query_string();
                    utils.log('search: ' + qs);

                    if (endpoint.url) {
                        var category_renderer = new scopes.lib.CategoryRenderer(TEMPLATE);
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

                        webdav.getDir(endpoint, dir).then(function(contents, res) {
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
                                utils.warn('empty folder');

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
                                            file_result.set('size', utils.nice_bytes(file.size));
                                            file_result.set('mime', JSON.stringify(file.mime));

                                            var ext = path.extname(file.filename);
                                            //TODO do this checking based on mimetype
                                            if (filetypes.text.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_text.png'));
                                            }
                                            else if (filetypes.doc.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_doc.png'));
                                            }
                                            else if (filetypes.image.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_image.png'));
                                            }
                                            else if (filetypes.video.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_movie.png'));
                                            }
                                            else if (filetypes.audio.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_sound.png'));
                                            }
                                            else if (filetypes.archive.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_zip.png'));
                                            }
                                            else if (filetypes.pdf.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_pdf.png'));
                                            }
                                            else if (filetypes.code.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_code.png'));
                                            }
                                            else if (filetypes.powerpoint.indexOf(ext) >= 0) {
                                                file_result.set_art(path.join(scope.scope_directory, 'file_ppt.png'));
                                            }
                                            else if (filetypes.spreadsheet.indexOf(ext) >= 0) {
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

                                utils.log('finished searching');
                                search_reply.finished();
                            }
                        })
                        .catch(function(err) {
                            utils.error('error reading dir: ' + err.message);

                            if (err.code == 401) {
                                search_reply.push(error_result(search_reply, 'unauthorized', 'You are not properly logged in', 'Check the settings', err.message));
                            }
                            else if (err.code == 403) {
                                search_reply.push(error_result(search_reply, 'forbidden', 'You do not have access to this folder', dir, err.message));
                            }
                            else {
                                search_reply.push(error_result(search_reply, 'list-error', 'Error reading folder', dir, err.message));
                            }

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
                        message.add_attribute_value('text', 'Error Message: ' + result.get('message'));

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
            utils.log('activating: ' + result.uri());

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
            utils.log('performing action: ' + action_id);

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
