"use strict";

var path = require("path");
var _ = require("lodash");

/**
 * Default Options
 */
var defaults = {
    position: "append",
    replacement: "time"
};

/**
 * @param {string} src
 * @param {object} [config]
 * @returns {string}
 */
exports.breakCache = function(src, config) {

    var matcher = config.match;
    var opts = mergeOptions(_.cloneDeep(defaults), config);

    function replacer(src, match) {
        var replacement = _getReplacement(src, opts.replacement, opts, match);
        var replacer = _getReplacer(opts.position, replacement);
        var regex = _getRegex(match, opts.position);
        return src.replace(regex, replacer);
    }

    if (Array.isArray(matcher)) {
        matcher.forEach(function(match) {
            src = replacer(src, match);
        });
    } else {
        return replacer(src, matcher);
    }

    return src;
};

/**
 * @param {string|function} replacement
 * @param config
 * @returns {*}
 */
function _getReplacement(src, replacement, config, match) {
    if (replacement === "time") {
        return new Date().getTime().toString();
    }
    if (replacement === "md5") {
        var filePath = String(src.match(_getRegex(match, config.position)));
        if (filePath !== 'null') {
            // _getRegex returns string with "" inside the string - needs to be removed
            filePath = filePath.slice(1, (filePath.length - 1)).split("?")[0];
            if (config.currPath) {
                var filePath = joinPath(config.currPath, filePath);
                var content = getFileContents(filePath);
                if (content) {
                    return md5(content, config.length || 10);
                }
            }
        }
    }

    return replacement;
}

/**
 * @param {string} matcher
 * @param {string} position
 * @returns {RegExp}
 */
function _getRegex(matcher, position) {

    function fullMatcher() {
        return new RegExp("(('|\")(.+?)?)(" + matcher + ")([\\w\\?=]*)('|\")", "g");
    }

    function prepareString(seg) {
        var result = seg.replace(/\./g, "\\.");
        return "(" + result + ")";
    }

    /**
     * @type {{overwrite: overwrite, filename: fullMatcher, append: fullMatcher}}
     */
    var regexs = {
        overwrite: function() {
            var split = matcher.split("*");
            var before = prepareString(split[0]);
            var after = prepareString(split[1]);
            return new RegExp(before + "(?:.+?)" + after, "g");
        },
        filename: fullMatcher,
        append: fullMatcher
    };

    if (regexs[position]) {
        return regexs[position]();
    }
}

/**
 * @param {string} type
 * @returns {string|function}
 * @param {string|function} replacement
 * @private
 */
function _getReplacer(type, replacement) {

    function replace(string) {
        return string.replace("%time%", replacement);
    }

    var templates = {
        append: replace("$1$4?rel=%time%$6"),
        filename: function() {
            var start = arguments[1];
            var end = arguments[6];
            var match = arguments[4];
            var file = path.basename(match).split(".");
            var ext = file.pop();
            return replace(start + file.join(".") + ".%time%." + ext + end);
        },
        overwrite: replace("$1%time%$2")
    };

    return templates[type];
}
exports._getReplacer = _getReplacer;

/**
 * @param filepath
 * @returns {*}
 */
function getFileContents(filepath) {
    var path = require("path");
    var fs = require("fs");
    filepath = path.resolve(filepath);
    return fs.readFileSync(filepath, 'utf-8');
}

/**
 * @param {object} defaults
 * @param {object} config
 * @returns {object}
 */
function mergeOptions(defaults, config) {
    return _.merge(defaults, config);
}

/**
 * @param src
 */
function md5(src, length) {
    var crypto = require('crypto');
    var hash = crypto.createHash('md5').update(src, 'utf8').digest('hex');
    return hash.slice(0, length);
}

function joinPath() {
    var parts = [];
    var prefix = "";
    //save prefix before split for join items when one of them is url
    if (arguments[0].indexOf("//") > -1) {
        prefix = arguments[0].split("//") || "";
        arguments[0] = prefix[1];
        prefix = prefix[0] + "//";
    }
    for (var i = 0, l = arguments.length; i < l; i++) {
        parts = parts.concat(arguments[i].split("/"));
    }
    var newParts = [];
    for (i = 0, l = parts.length; i < l; i++) {
        var part = parts[i];
        if (!part || part === ".") continue;
        if (part === "..") newParts.pop();
        else newParts.push(part);
    }
    if (parts[0] === "") newParts.unshift("");
    return prefix + (newParts.join("/") || (newParts.length ? "/" : "."));
}