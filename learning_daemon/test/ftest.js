/*global require, module, console, debug, exports, process, Buffer, setImmediate, setTimeout, setInterval, clearInterval */

var blob = require('../lib/blob.js');
var remain = '';
var count = 0;
// set /etc/security/limits.conf
blob.find('/home/bazhou/local/src', function (buf) {
    var lines = [remain, buf.toString()].join('').split('\n');
    if (lines[lines.length - 1].length > 0) {
        remain = lines.pop();
    } else {
        remain = '';
    }

    lines.forEach(function (file_path) {
        if (file_path.length > 0) {
            blob.lmd5(file_path, function (err, md5) {
                count += 1;
                console.log(count, md5, file_path);
            });
        }
    });
});