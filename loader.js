var dotenv = require("dotenv"),
    path = require('path'),
    os = require('os'),
    fs = require('fs'),
    childProcess = require('child_process'),
    execFile = childProcess.execFile,
    execFileSync = childProcess.execFileSync

var ENVKEY_FETCH_VERSION = "1.2.5"

function pickPermitted(vars, opts) {
    if (opts && opts.permitted && opts.permitted.length) {
        var res = {}
        for (k in vars) {
            if (opts.permitted.indexOf(k) != -1) {
                res[k] = vars[k]
            }
        }
        return res
    } else {
        return vars
    }
}

function applyVarsToEnv(vars) {
    var varsSet = {}
    for (k in vars) {
        if (!process.env.hasOwnProperty(k)) {
            var val = vars[k]
            process.env[k] = val
            varsSet[k] = val
        }
    }

    return varsSet
}

function getKey(opts) {
    if (opts.dotEnvFile) {
        dotenv.load({ path: "./" + opts.dotEnvFile })
    } else {
        dotenv.config()
    }

    return process.env.ENVKEY
}

function keyError() {
    return "ENVKEY invalid. Couldn't load vars."
}

function missingKeyError() {
    return "ENVKEY missing - must be set as an environment variable or in a gitignored .env file in the root of your project. Go to https://www.envkey.com if you don't know what an ENVKEY is."
}

function throwMissingKeyError() {
    var err = missingKeyError()
    throw err
}

function throwKeyError() {
    var err = keyError()
    throw err
}

function load(optsOrCb, maybeCb) {
    var opts = typeof optsOrCb == "object" ? optsOrCb : {},
        cb = typeof optsOrCb == "function" ? optsOrCb : maybeCb,
        key;

    try {
        key = getKey(opts)
    } catch (err) {
        if (cb) {
            cb(err)
        } else {
            throw (err)
        }
    }

    if (key) {
        if (cb) {
            fetch(key, opts, function(err, vars) {
                if (err) {
                    cb(err)
                } else {
                    cb(null, applyVarsToEnv(vars))
                }
            })
        } else {
            return applyVarsToEnv(fetch(key, opts))
        }
    } else if (cb) {
        cb(missingKeyError())
    } else {
        throw missingKeyError()
    }
}

function fetch(keyOrCbOrOpts, optsOrCb, maybeCb) {
    var key, opts, cb

    if (typeof keyOrCbOrOpts == "object") {
        opts = keyOrCbOrOpts
    } else if (typeof optsOrCb == "object") {
        opts = optsOrCb
    } else {
        opts = {}
    }

    if (typeof keyOrCbOrOpts == "function") {
        cb = keyOrCbOrOpts
    } else if (typeof optsOrCb == "function") {
        cb = optsOrCb
    } else {
        cb = maybeCb
    }

    try {
        key = typeof keyOrCbOrOpts == "string" ? keyOrCbOrOpts : getKey(opts)
    } catch (err) {
        if (cb) {
            cb(err)
        } else {
            throw (err)
        }
    }

    if (!key && cb) {
        return cb(null, {})
    } else if (!key) {
        return {}
    }

    var platform = os.platform(),
        arch = os.arch(),
        platformPart,
        archPart

    switch (platform) {
        case 'darwin':
        case 'linux':
            platformPart = platform
            break
        case 'freebsd':
        case 'openbsd':
            platformPart = "freebsd"
            break
        case 'win32':
            platformPart = "windows"
            break
        default:
            platformPart = "linux"
    }

    switch (arch) {
        case 'ia32':
        case 'x32':
        case 'x86':
        case 'mips':
        case 'mipsel':
        case 'ppc':
        case 's390':
            archPart = "386"
            break
        case 'x64':
        case 'ppc64':
        case 's390x':
            archPart = "amd64"
            break
        default:
            archPart = "386"
    }

    var isDev = false
    if (!process.env.NODE_ENV) {
        var dotenvPath = path.resolve(process.cwd(), '.env')
        isDev = fs.existsSync(dotenvPath)
    } else if (["development", "test"].indexOf(process.env.NODE_ENV) > -1) {
        isDev = true
    }

    var ext = platformPart == "windows" ? ".exe" : "",
        filePath = path.join(__dirname, "ext", ["envkey-fetch", ENVKEY_FETCH_VERSION, platformPart, archPart].join("_"), ("envkey-fetch" + ext)),
        execArgs = [key, (isDev ? "--cache" : ""), "--client-name", "envkey-node", "--client-version", "1.2.7"]

    if (cb) {
        execFile(filePath, execArgs, function(err, stdoutStr, stderrStr) {
            if (err) {
                cb(stderrStr)
            } else if (stdoutStr.indexOf("error: ") == 0) {
                cb(stdoutStr)
            } else {
                var json = JSON.parse(stdoutStr)
                cb(null, pickPermitted(json, opts))
            }
        })

    } else {
        try {
            console.log(filePath)
            console.log(execArgs)
            console.log('File Exists', fs.existsSync(path))
            let filesInnode_modules = fs.readdirSync('/var/task/node_modules')
            let filesInEnvkey = fs.readdirSync('/var/task/node_modules/envkey')
            let filesInExt = fs.readdirSync('/var/task/node_modules/envkey/ext')
            console.log('filesInnode_modules', filesInnode_modules)
            console.log('filesInEnvkey', filesInEnvkey)
            console.log('filesInExt', filesInExt)
            var res = execFileSync(filePath, execArgs).toString()
            console.log('res', res)

            if (!res || !res.trim()) {
                throwKeyError()
            }

            var json = JSON.parse(res.toString())

            if (!json) {
                throwKeyError()
            }

            return pickPermitted(json, opts)
        } catch (e) {
            if (e.stderr) {
                console.error(e.stderr.toString())
                throw (e.stderr.toString())
            } else {
                console.error(e.stack)
                throw (e)
            }
        }
    }
}

module.exports = { load: load, fetch: fetch }