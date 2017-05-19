/*global define, require, module, console, debug, exports, process, Buffer, setImmediate, setTimeout, setInterval, clearInterval */
const http = require('http');
const crypto = require('crypto');
const blobClient = require('azure-storage').createBlobService();
const async = require('async');
const stream = require('stream');
const mime = require('mime-types');
const fs = require('fs');
const spawn = require('child_process').spawn;

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
        typeof define === 'function' && define.amd ? define(['exports'], factory) :
        (factory((global.blob = global.blob || {})));
}(this, (function (exports) {
    'use strict';
    exports.info = "blob";

    exports.rmd5 = function (path, cb) {
        var options = {
            method: 'HEAD',
            host: 'bazhou.azureedge.net',
            port: 80,
            path: ["/learning", path].join('/')
        };
        var req = http.request(options, function (res) {
            if (res.statusCode === 200) {
                cb(null, res.headers["content-md5"]);
            } else {
                cb(null, 'no md5');
            }
        });
        req.end();
    };

    exports.lmd5 = function (path, cb) {
        try {
            var s = new fs.ReadStream(path);
            var md5sum = crypto.createHash('md5');
            s.on('data', function (d) {
                md5sum.update(d);
            });
            s.on('end', function () {
                var d = md5sum.digest('base64');
                cb(null, d);
            });
        } catch (e) {
            cb(e);
        }
    };

    exports.upload = function (option, cb) {
        var container = option.container || 'learning';
        var upload_option = {
            blockIdPrefix: 'block',
            contentType: mime.lookup(option.file_path) || 'application/octet-stream',
            cacheControl: "max-age=720000"
        };
        var s = blobClient.createWriteStreamToBlockBlob(
            container,
            option.uri_in_container,
            upload_option,
            function (err) {
                if (err) {
                    cb(err);
                } else {
                    cb(null, {
                        contenttype: mime.lookup(option.file_path),
                        file: option.file_path,
                        url: option.uri_in_container,
                        status: 'uploading'
                    });
                }
            });
        fs.createReadStream(option.file_path).pipe(s);
    };

    exports.sync = function (option, cb) {
        async.parallel([
                function (callback) {
                    exports.rmd5(option.uri_in_container, callback);
                },
                function (callback) {
                    exports.lmd5(option.file_path, callback);
                }
            ],
            function (err, results) {
                if (err) {
                    cb(err, {
                        status: 'error'
                    });
                } else {
                    if (results[0] === results[1]) {
                        cb(null, {
                            status: 'done'
                        });
                    } else {
                        exports.upload(option, cb);
                    }
                }
            });
    };

    exports.find = function (path, cb, final) {
        const cmd = spawn('find', [path, '-type', 'f']);
        cmd.stdout.on('data', function (data) {
            cb(data);
        });

        cmd.on('close', function () {
            if (typeof final === 'function') {
                final();
            }
        });
    };

    Object.defineProperty(exports, '__esModule', {
        value: true
    });
})));