/*global require, module, console, debug, exports, process, Buffer, setImmediate, setTimeout, setInterval, clearInterval */
var blob = require('../lib/blob.js');
const async = require('async');
const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;
const dgram = require('dgram');
const net = require('net');
var remain = '';
var count = 0;
var input_len = 0;
const line_port = 8012;
const report_port = 8013;
if (cluster.isMaster) {
    console.error(`Master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    var connect_pool = new Set();
    var report_server = net.createServer(c => {
        var msg = '';
        c.on('end', err => {
            if (!err) {
                var pid = JSON.parse(msg).pid;
                connect_pool.add(pid);
                if (connect_pool.size === numCPUs) {
                    report_server.close();
                }
            }
        });
        c.on('data', chunk => {
            msg += chunk;
        });
    });
    report_server.listen(report_port);
    report_server.on('error', err => {
        console.error(err);
    });
    report_server.on('listening', () => {
        var address = report_server.address();
        console.error(`Master ${process.pid} listen :${address.port}`);
    });
    report_server.on('close', function () {
        console.error('report server closed');
        var buffer_len = numCPUs;
        var c = 0;
        var q = async.queue(function (task, callback) {
            var dispatcher = net.connect({
                port: line_port
            });
            c += task.send_buf.length;
            dispatcher.write(JSON.stringify(task.send_buf), 'utf-8', function (err) {
                if (err) {
                    console.error('send error:', err);
                } else {
                    // console.error('send:', c, input_len);
                    if (c === 30763) {
                        setTimeout(function () {
                            process.exit();
                        }, 1000);
                    }

                    dispatcher.end();
                }
                callback();

            });
        }, numCPUs);

        q.drain = function () {
            // console.error("queue drain");
        };

        blob.find('/home/bazhou/local/src', function (buf) {
            var lines = [remain, buf.toString()].join('').split('\n');
            if (lines[lines.length - 1].length > 0) {
                remain = lines.pop();
            } else {
                remain = '';
            }
            input_len += lines.length;
            var i = 0;
            while (i < lines.length) {
                var send_buf = [];
                var len = i + ((i + buffer_len < lines.length) ? buffer_len : (lines.length - i));
                var j;
                for (j = i; j < len; j += 1) {
                    if (lines[j] && lines[j].length > 0) {
                        send_buf.push(lines[j]);
                    } else {
                        console.error('error ', i, j, len, lines.length);
                    }
                }
                q.push({
                    send_buf: send_buf
                });
                i = j;
            }
        }, function final() {});

    });
    cluster.on('exit', (worker, code, signal) => {
        console.error(`worker ${worker.process.pid} died`);
    });

} else {
    var connect_reporter = net.connect({
        port: report_port
    });

    var worker_server = net.createServer(c => {
        var msg = '';
        var q = async.queue(function (task, callback) {
            const file_paths = task.files;
            var result = 0;
            file_paths.forEach(function (file_path) {
                if (file_path) {
                    blob.lmd5(file_path, function (err, md5) {
                        if (err) {
                            result += 1;
                        } else {
                            result += 1;
                            console.log(process.pid, file_path, md5);
                        }

                        if (result === task.files.length) {
                            callback();
                        }
                    });
                }
            });
        }, 1);

        q.drain = function () {
            setTimeout(function () {

            }, 100);
            // console.error("worker", process.pid, 'drain');
        };

        c.on('end', error => {
            if (msg) {
                q.push({
                    files: JSON.parse(msg)
                });
                msg = '';
            }
        });
        c.on('data', chunk => {
            msg += chunk;
        });
    });
    worker_server.on('error', err => {
        console.error(err);
        worker_server.end();
    });
    worker_server.on('listening', () => {
        var address = worker_server.address();
        connect_reporter.write(JSON.stringify({
            pid: process.pid
        }), 'utf-8', function (err) {
            connect_reporter.end();
        });
        console.error(`worker ${process.pid} listening on ${address.address}:${address.port}`);
    });
    worker_server.listen(line_port);
    process.on('message', msg => {
        if (msg === 'disconnect') {
            console.error(process.pid, 'receive disconnect command');
            worker_server.unref();
            cluster.worker.disconnect();
            cluster.worker.kill();
        }
    });
}