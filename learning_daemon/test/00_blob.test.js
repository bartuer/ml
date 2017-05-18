/*global before, __dirname, describe, it, expect, require, module, console, debug, exports, process, Buffer, setImmediate, setTimeout, setInterval, clearInterval */

var blob = require('../lib/blob.js');
var service = require('azure-storage').createBlobService();
var assert = require('assert');

describe('blob avoid transfer', function () {
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

    it('sync', function (done) {
        blob.sync({
            file_path: `${__dirname}/../az_upload`,
            uri_in_container: 'ml/learning_daemon/az_upload'
        }, function (err, result) {
            assert(err === null);
            assert(result.status === "done");
            done();
        });
    });
});

describe('blob transfer', function () {
    before(function (done) {
        service.deleteBlobIfExists('learning', 'ml/learning_daemon/az_upload', function (err) {
            if (err) {
                console.error('delete blob failed', err);
            }
            done();
        });
    });

    it('lmd5', function (done) {
        blob.lmd5(`${__dirname}/../az_upload`, function (err, md5) {
            assert(err === null);
            assert(md5 === "kx+Ev7N9LQnKBzZNpUNnhQ==");
            done();
        });
    });

    it('sync', function (done) {
        blob.sync({
            file_path: `${__dirname}/../az_upload`,
            uri_in_container: 'ml/learning_daemon/az_upload'
        }, function (err, result) {
            assert(err === null);
            assert(result.status === "uploading");
            done();
        });
    });
});