/*global require, module, console, debug, exports, process, Buffer, setImmediate, setTimeout, setInterval, clearInterval */
var blob = require('../lib/blob.js');
const async = require('async');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const net = require('net');
const line_port = 8012;
const report_port = 8013;
const root = '/home/bazhou/local/src/upload/llvm';
const container_path = 'ml/learning/test';

if (cluster.isMaster) {
    console.time('connection ACK done');
    let total = 0;
    var total_entries = 0;
    var messageHandler = function (msg) {
        total += msg.count;
        console.log("total = ", total, total_entries);
        if (total === total_entries) {
            cluster.disconnect();
        }
    };

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        var worker = cluster.fork();
        worker.setMaxListeners(numCPUs + 1);
        worker.on('message', messageHandler);
    }

    function init_task() {
        var remain = '';
        var input_len = 0;
        var buffer_len = 6;
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
                    dispatcher.end();
                }
                callback();

            });
        }, numCPUs);

        q.saturated = function () {
            // console.error('pressure on queue:', q.concurrency);
        };
        q.drain = function () {
            total_entries = c;
            // console.error("queue drain");
        };

        blob.find(root, function (buf) {
            var lines = [remain, buf.toString()].join('').split('\n');
            if (lines[lines.length - 1].length > 0) {
                remain = lines.pop();
            } else {
                remain = '';
            }
            input_len += lines.length;
            total_entries = input_len;
            console.log("total_entries = ", total_entries);
            var i = 0;
            while (i < lines.length) {
                var send_buf = [];
                var len = i + ((i + buffer_len < lines.length) ? buffer_len : (lines.length - i));
                var j;
                for (j = i; j < len; j += 1) {
                    if (lines[j] && lines[j].length > 0) {
                        send_buf.push(lines[j]);
                    } else {
                        // console.error('buffer edge ', i, j, len, lines.length);
                    }
                }
                q.push({
                    send_buf: send_buf
                });
                i = j;
            }
        }, function final() {});
    }

    var connect_pool = new Set();
    var report_server = net.createServer(c => {
        var msg = '';
        c.on('end', err => {
            if (!err) {
                var pid = JSON.parse(msg).pid;
                connect_pool.add(pid);
                if (connect_pool.size === numCPUs) {
                    init_task();
                    report_server.unref();
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
        console.error(`master.${process.pid} connect ACK  on :${address.port}`);
    });

    cluster.on('exit', (worker, code, signal) => {
        console.error(`worker.${worker.process.pid} disconnect EXIT ${code} SIGNAL ${signal}`);
    });
} else {
    var connect_reporter = net.connect({
        port: report_port
    });

    var worker_server = net.createServer(c => {
        var count = 0;
        var msg = '';
        var q = async.queue(function (task, q_callback) {
            const file_paths = task.files;
            var result = 0;
            file_paths.forEach(function (file_path) {
                if (file_path) {
                    blob.sync({
                        file_path: file_path,
                        uri_in_container: file_path.replace(root, container_path)
                    }, function (err, results) {
                        result += 1;
                        if (err) {
                            console.error('error in worker', err, process.pid);
                            if (result === task.files.length) {
                                count = result;
                                q_callback();
                            }
                        } else {
                            console.log(result, process.pid, 'uploaded', file_path);
                            if (result === task.files.length) {
                                count = result;
                                q_callback();
                            }
                        }
                    });
                }
            });
        }, 1);

        q.saturated = function () {};

        q.drain = function () {
            process.send({
                pid: process.pid,
                count: count
            });
            count = 0;
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
    worker_server.listen(line_port);
    worker_server.on('listening', () => {
        var address = worker_server.address();
        connect_reporter.write(JSON.stringify({
            pid: process.pid
        }), 'utf-8', function (err) {
            connect_reporter.end();
        });
        console.error(`worker.${process.pid} receive task on :${address.port}`);
    });
    worker_server.on('error', err => {
        console.error(err);
        worker_server.end();
    });
}