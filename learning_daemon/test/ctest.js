/*global require, module, console, debug, exports, process, Buffer, setImmediate, setTimeout, setInterval, clearInterval */
var blob = require('../lib/blob.js');
const async = require('async');
const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;
const dgram = require('dgram');
var remain = '';
var count = 0;
var input_len = 0;
const line_port = 8012;
const report_port = 8013;
if (cluster.isMaster) {
    // console.log(`Master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    var report_server = dgram.createSocket('udp6');
    report_server.bind(report_port);
    report_server.on('error', err => {
        // console.error(err);
        report_server.close();
    });
    report_server.on('listening', () => {
        var address = report_server.address();
        // console.log(`M${process.pid} listen :${address.port}`);
    });
    report_server.once('message', (msg, rinfo) => {
        // console.log('worker available', rinfo);
        var dispatcher = dgram.createSocket('udp6');
        var buffer_len = 12;
        var c = 0;
        var q = async.queue(function (task, callback) {
            dispatcher.send(Buffer.from(JSON.stringify(task.send_buf)), line_port, 'localhost', function (err) {
                c += task.send_buf.length;
                if (err) {
                    console.log('send error:', err);
                } else {
                    console.log('send:', c, input_len);
                }
                callback();
            });
        }, numCPUs / 8);
        q.drain = function () {
            // console.log("queue drain");
        };
        blob.find('/home/bazhou/local/src', function (buf) {
            var lines = [remain, buf.toString()].join('').split('\n');
            if (lines[lines.length - 1].length > 0) {
                remain = lines.pop();
            } else {
                remain = '';
            }
            input_len += lines.length;
            var i;

            for (i = 0; i < lines.length; i += buffer_len) {
                var send_buf = [];
                var len = i + ((i + buffer_len < lines.length) ? buffer_len : lines.length % buffer_len);
                var j;
                for (j = i; j < len; j += 1) {
                    send_buf.push(lines[j]);
                }
                q.push({
                    send_buf: send_buf
                });
            }
        }, function final() {});
    });
    report_server.on('message', (msg, rinfo) => {
        var results = JSON.parse(msg.toString());
        if (!results.i) {
            results.forEach(function (result) {
                if (result.f) {
                    count += 1;
                    console.log(`bazhoucount: ${count}/${input_len}`, result.p, result.f, result.m ? result.m : result.e);
                    if (count > 30670) {
                        for (const id in cluster.workers) {
                            cluster.workers[id].kill();
                        }
                        cluster.disconnect();
                        report_server.unref();
                        setTimeout(function () {
                            process.exit();
                        }, 0);
                    }
                } else {
                    // console.log(result);
                }
            });
        }
    });
    cluster.on('exit', (worker, code, signal) => {
        // console.log(`worker ${worker.process.pid} died`);
    });

} else {
    var connect_reporter = dgram.createSocket('udp6');
    var worker_server = dgram.createSocket('udp6');
    worker_server.on('error', err => {
        console.error(err);
        worker_server.close();
    });
    worker_server.bind(line_port);
    var q = async.queue(function (task, callback) {

        const file_paths = task.files;
        const result = [];
        var reporter = dgram.createSocket('udp6');
        file_paths.forEach(function (file_path) {
            if (file_path) {
                blob.lmd5(file_path, function (err, md5) {
                    if (err) {
                        result.push({
                            e: err.toString(),
                            f: file_path,
                            p: process.pid
                        });
                    } else {
                        result.push({
                            m: md5,
                            f: file_path,
                            p: process.pid
                        });
                    }

                    if (result.length === task.files.length) {
                        reporter.send(Buffer.from(JSON.stringify(result)), report_port, 'localhost', function () {
                            console.log('bazhoumd5', result.length);
                            reporter.close();
                            callback();
                        });
                    }
                });
            }
        });
    }, 1);

    worker_server.on('message', (msg, rinfo) => {
        q.push({
            files: JSON.parse(msg.toString())
        });
    });

    q.drain = function () {
        // console.log("worker", process.pid, 'drain');
    };

    process.on('message', msg => {
        if (msg === 'disconnect') {
            // console.log(process.pid, 'receive disconnect command');
            worker_server.unref();
            cluster.worker.disconnect();
            cluster.worker.kill();
        }
    });
    worker_server.on('listening', () => {
        var address = worker_server.address();
        connect_reporter.send(Buffer.from(JSON.stringify({
            i: true
        })), report_port, 'localhost', function () {
            connect_reporter.close();
        });
        // console.log(`worker ${process.pid} listening on ${address.address}:${address.port}`);
    });

}