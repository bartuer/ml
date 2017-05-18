/*global __dirname, describe, it, expect, require, module, console, debug, exports, process, Buffer, setImmediate, setTimeout, setInterval, clearInterval */

var blob = require('../lib/blob.js');
var assert = require('assert');

describe('blob', function () {
    it('lmd5', function (done) {
        blob.lmd5(`${__dirname}/../az_upload`, function (err, md5) {
            assert(err === null);
            assert(md5 === "kx+Ev7N9LQnKBzZNpUNnhQ==");
            done();
        });
    });

    it('rmd5', function (done) {
        blob.rmd5('ml/learning_daemon/az_upload', function (err, md5) {
            assert(err === null);
            assert(md5 === "kx+Ev7N9LQnKBzZNpUNnhQ==");
            done();
        });
    });

    it('upload', function (done) {
        blob.upload({
            file_path: `${__dirname}/../az_upload`,
            uri_in_container: 'ml/learning_daemon/az_upload'
        }, function (err, result) {
            assert(err === null);
            assert(result.url === "ml/learning_daemon/az_upload");
            done();
        });
    });

});