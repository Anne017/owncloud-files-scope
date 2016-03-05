var moment = require('moment');
var path = require('path');

var webdav = require('./webdav');
var utils = require('./utils');
var filetypes = require('./filetypes');
var translations = require('./translations');
var _ = translations._;

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
                        var file_category = search_reply.register_category('files', _('Files'), '', category_renderer);
                        var folder_category = search_reply.register_category('folders', _('Folders'), '', category_renderer);
                        var actions_category = search_reply.register_category('actions', _('Actions'), '', category_renderer);

                        var dir = qs || '/';
                        if (dir.charAt(0) != '/') {
                            dir = '/' + dir;
                        }

                        if (dir != '/') {
                            var parent = path.normalize(path.join(dir, '..'));

                            var parent_result = new scopes.lib.CategorisedResult(folder_category);
                            parent_result.set_uri('scope://owncloud-files-scope.bhdouglass_owncloud-files?q=/' + utils.sanitize_path(parent));
                            parent_result.set_title(_('Parent Folder'));
                            parent_result.set('file', false);
                            parent_result.set('path', parent);
                            parent_result.set_intercept_activation();
                            parent_result.set_art(path.join(scope.scope_directory, 'parent.png'));

                            search_reply.push(parent_result);
                        }

                        webdav.getDir(endpoint, dir).then(function(contents, res) {
                            var contents = contents.sort(function(a, b) {
                                if (a.type == 'file' && b.type == 'directory') {
                                    return 1;
                                }
                                else if (a.type == 'directory' && b.type == 'file') {
                                    return -1;
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

                                search_reply.push(error_result(search_reply, 'empty-folder', _('This folder is empty'), dir, '', _('Empty Folder')));
                                search_reply.finished();
                            }
                            else {
                                var hide_dot = (scope.settings.hide_dot === undefined) ? true : scope.settings.hide_dot.get_bool();
                                var gallery = [];
                                var playlist = [];

                                for (var index in contents) {
                                    var file = contents[index];

                                    if (file) {
                                        if (hide_dot && path.basename(file.filename).charAt(0) == '.') {
                                            continue;
                                        }
                                        else {
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
                                                else if (filetypes.preview_image.indexOf(ext) >= 0) {
                                                    file_result.set_art(utils.download_link(endpoint.url, file.filename));
                                                    gallery.push(utils.download_link(endpoint.url, file.filename));
                                                }
                                                else if (filetypes.image.indexOf(ext) >= 0) {
                                                    file_result.set_art(path.join(scope.scope_directory, 'file_image.png'));
                                                }
                                                else if (filetypes.preview_video.indexOf(ext) >= 0) {
                                                    file_result.set_art(path.join(scope.scope_directory, 'file_movie.png'));
                                                    //file_result.set('video', true);
                                                    //TODO figure out why videos won't play
                                                }
                                                else if (filetypes.video.indexOf(ext) >= 0) {
                                                    file_result.set_art(path.join(scope.scope_directory, 'file_movie.png'));
                                                }
                                                else if (filetypes.preview_audio.indexOf(ext) >= 0) {
                                                    file_result.set_art(path.join(scope.scope_directory, 'file_sound.png'));
                                                    file_result.set('audio', true);
                                                    playlist.push(utils.download_link(endpoint.url, file.filename));
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
                                                folder_result.set_uri('scope://owncloud-files-scope.bhdouglass_owncloud-files?q=/' + utils.sanitize_path(file.filename));
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
                                }

                                if (gallery.length > 0) {
                                    var gallery_result = new scopes.lib.CategorisedResult(actions_category);
                                    gallery_result.set_uri(dir + '#gallery');
                                    gallery_result.set_title(_('Gallery'));
                                    gallery_result.set_art(path.join(scope.scope_directory, 'file_image.png'));
                                    gallery_result.set('path', dir);
                                    gallery_result.set('gallery', JSON.stringify(gallery));

                                    search_reply.push(gallery_result);

                                    var gallery_shuffle_result = new scopes.lib.CategorisedResult(actions_category);
                                    gallery_shuffle_result.set_uri(dir + '#gallery-shuffle');
                                    gallery_shuffle_result.set_title(_('Shuffled Gallery'));
                                    gallery_shuffle_result.set_art(path.join(scope.scope_directory, 'file_image.png'));
                                    gallery_shuffle_result.set('path', dir);
                                    gallery_shuffle_result.set('gallery', JSON.stringify(gallery));
                                    gallery_shuffle_result.set('shuffle', true);

                                    search_reply.push(gallery_shuffle_result);
                                }

                                if (playlist.length > 0) {
                                    var playlist_result = new scopes.lib.CategorisedResult(actions_category);
                                    playlist_result.set_uri(dir + '#playlist');
                                    playlist_result.set_title(_('Playlist'));
                                    playlist_result.set_art(path.join(scope.scope_directory, 'file_sound.png'));
                                    playlist_result.set('path', dir);
                                    playlist_result.set('playlist', JSON.stringify(playlist));

                                    search_reply.push(playlist_result);

                                    var shuffle_result = new scopes.lib.CategorisedResult(actions_category);
                                    shuffle_result.set_uri(dir + '#shuffle');
                                    shuffle_result.set_title(_('Shuffled Playlist'));
                                    shuffle_result.set_art(path.join(scope.scope_directory, 'file_sound.png'));
                                    shuffle_result.set('path', dir);
                                    shuffle_result.set('playlist', JSON.stringify(playlist));
                                    shuffle_result.set('shuffle', true);

                                    search_reply.push(shuffle_result);
                                }

                                utils.log('finished searching');
                                search_reply.finished();
                            }
                        })
                        .catch(function(err) {
                            utils.error('error reading dir: ' + err.message);

                            if (err.code == 401) {
                                search_reply.push(error_result(search_reply, 'unauthorized', _('You are not properly logged in'), _('Check the settings'), err.message));
                            }
                            else if (err.code == 403) {
                                search_reply.push(error_result(search_reply, 'forbidden', _('You do not have access to this folder'), dir, err.message));
                            }
                            else if (err.code == 404) {
                                search_reply.push(error_result(search_reply, 'not-found', _('Folder not found'), dir, err.message));
                            }
                            else {
                                search_reply.push(error_result(search_reply, 'list-error', _('Error reading folder'), dir, err.message));
                            }

                            search_reply.finished();
                        });
                    }
                    else { //No connection put an error result
                        search_reply.push(error_result(search_reply, 'no-connection', _('No connection to ownCloud'), _('Check the scope settings')));
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
                        message.add_attribute_value('text', _('Error Message') + ': ' + result.get('message'));

                        preview_reply.push([error_image, error_header, message]);
                    }
                    else {
                        var image = new scopes.lib.PreviewWidget('image', 'image');
                        image.add_attribute_mapping('source', 'art');

                        var header = new scopes.lib.PreviewWidget('header', 'header');
                        header.add_attribute_mapping('title', 'title');
                        header.add_attribute_value('subtitle', path.dirname(result.get('path')));

                        if (result.get('audio')) {
                            var audio = new scopes.lib.PreviewWidget('audio', 'audio');
                            audio.add_attribute_value(
                                'tracks',
                                {
                                    'title': result.title(),
                                    'source': utils.download_link(endpoint.url, result.get('path')),
                                }
                            );

                            preview_reply.push([image, audio]);
                        }
                        else if (result.get('video')) {
                            var video = new scopes.lib.PreviewWidget('video', 'video');
                            video.add_attribute_value('source', utils.download_link(endpoint.url, result.get('path')));

                            preview_reply.push([video, header]);
                        }
                        else if (result.get('gallery')) {
                            var gallery = new scopes.lib.PreviewWidget('gallery', 'gallery');
                            var images = JSON.parse(result.get('gallery'));
                            if (result.get('shuffle')) {
                                utils.shuffle(images);
                            }

                            gallery.add_attribute_value('sources', images);

                            preview_reply.push([header, gallery]);
                        }
                        else if (result.get('playlist')) {
                            var playlist = JSON.parse(result.get('playlist'));
                            var tracks = [];
                            for (var index in playlist) {
                                tracks.push({
                                    'title': path.basename(playlist[index]),
                                    'source': playlist[index],
                                });
                            }

                            if (result.get('shuffle')) {
                                utils.shuffle(tracks);
                            }

                            var audio = new scopes.lib.PreviewWidget('audio', 'audio');
                            audio.add_attribute_value('tracks', tracks);

                            preview_reply.push([image, audio]);
                        }
                        else {
                            preview_reply.push([image, header]);
                        }

                        if (result.get('mtime')) {
                            var mtime = new scopes.lib.PreviewWidget('mtime', 'text');
                            mtime.add_attribute_value('text', _('Last Modified') + ': ' + result.get('mtime'));

                            preview_reply.push([mtime]);
                        }

                        if (result.get('size')) {
                            var size = new scopes.lib.PreviewWidget('size', 'text');
                            size.add_attribute_value('text', _('File Size') + ': ' + result.get('size'));

                            preview_reply.push([size]);
                        }

                        if (result.get('file')) {
                            var download = new scopes.lib.PreviewWidget('actions', 'actions');
                            download.add_attribute_value('actions',[
                                {
                                    id: 'download',
                                    label: _('Download'),
                                    uri: utils.download_link(endpoint.url, result.get('path')),
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
