#!/usr/bin/env node

/* eslint-env node */

'use strict';

import path, { dirname } from 'node:path';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';

import { fileURLToPath } from 'node:url';

import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

import webpackConfig from '../webpack.config.mjs';

import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import helmet from 'helmet';
import favicon from 'serve-favicon';

import extend from 'extend';
import _ from 'lodash';
import chalk from 'chalk';

import { logger } from 'note-down';

import libLocalIpAddressesAndHostnames from 'local-ip-addresses-and-hostnames';

import notifier from '../utils/notifications/notifications.mjs';

import hardCodedResponse from 'express-hard-coded-response';
import networkDelay from 'express-network-delay';
import redirectToWww from 'express-redirect-to-www';
import redirectToHttps from 'express-redirect-to-https';
import matchRequest from 'express-match-request';

import { basicAuth } from './middleware/basic-auth.mjs';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));

let localIpAddressesAndHostnames;

const packageJson = require('../package.json');

const routeSetup = async function (exp) {
    const router = express.Router();

    router
        .use('/admin', express.Router()
            .use('/', function (req, res, next) {
                logger.log('TODO: The access to this route needs to be limited to administrators only');
                next();
            })
            .use('/users', express.Router()
                .get('/', function (req, res) {
                    res.send('TODO: Serve the /GET request for /admin/users');
                })
                .get('/list', function (req, res) {
                    res.send('TODO: Serve the /GET request for /admin/users/list (List all the users)');
                })
            )
            .get('/', function (req, res) {
                res.send('TODO: Serve the /GET request for /admin');
            })
        )
        .use('/user-account', express.Router()
            .post('/create', function (req, res) {
                const reqBody = JSON.parse(JSON.stringify(req.body));

                // TODO: Validate whether "reqBody.username" exists or not
                res.send(`TODO: Create a user with ID ${reqBody.username} (if available)`);
            })
        )
        .use('/tasks', await (await import('./handlers/tasks/tasks.mjs')).setupTasksRoutes());

    setTimeout(function () {
        // Setting up this router after a delay so that live-css server router is able to attach itself before it
        router.use('*', function (req, res) {
            return res.status(404).send('Page not found');
        });
    }, 1000);

    exp.use('/', router);

    return router;
};

const logAndNotifyAboutServer = async function ({
    protocol,
    portNumber,
    flagNotifyServerPathsOnLaunch
}) {
    if (!localIpAddressesAndHostnames) {
        try {
            localIpAddressesAndHostnames = libLocalIpAddressesAndHostnames.getLocalIpAddressesAndHostnames();
        } catch (e) {
            localIpAddressesAndHostnames = [];
        }
    }

    const localhostPaths = _.uniq(localIpAddressesAndHostnames);

    if (localhostPaths.length) {
        if (localhostPaths.length === 1) {
            logger.verbose('This application can be accessed from the following path:' + ' (' + protocol + ' protocol)');
        } else {
            logger.verbose('This application can be accessed from any of the following paths:' + ' (' + protocol + ' protocol)');
        }

        const pathsToNotify = [];

        localhostPaths.forEach(function (localhostPath) {
            logger.verbose('\t' + protocol + '://' + localhostPath + ':' + portNumber);
            pathsToNotify.push(protocol + '://' + localhostPath + ':' + portNumber);
        });

        if (flagNotifyServerPathsOnLaunch) {
            notifier.info(`[${packageJson.name}] - Server listening at:`, '\t' + pathsToNotify.join('\n\t'));
        }
    } else {
        logger.verbose('This application is running an ' + protocol + ' server on port ' + portNumber);
        logger.warn('Warning: Unable to get the accessible hostnames / IP addresses');
    }
};

const application = {
    start: async function ({ configOptionsFileRootRelativePath }) {
        const projectRootFullPath = path.join(__dirname, '..');

        // const config = require('../' + configOptionsFileRootRelativePath);
        const config = (await import('../' + configOptionsFileRootRelativePath)).default;

        const exp = express();

        // Just a block
        {
            let useHmr = false;
            if (process.env.USE_HMR === 'yes') {
                useHmr = true;
            }

            if (useHmr) {
                const webpackConfigVal = await webpackConfig({
                    config: path.resolve(projectRootFullPath, configOptionsFileRootRelativePath)
                });
                const compiler = webpack(webpackConfigVal);

                exp.use(
                    webpackDevMiddleware(compiler, {
                        publicPath: '/'
                    })
                );

                exp.use(webpackHotMiddleware(compiler));
            }
        }

        exp.use(function (req, res, next) {
            // TODO:
            //     "logRequestInit" and "logResponseFinish" should come from config
            const
                logRequestInit = false,
                logResponseFinish = true;

            if (logRequestInit) {
                logger.verbose(req.method + ' ' + req.originalUrl);
            }

            if (logResponseFinish) {
                // TODO:
                //     Potentially, res.on('finish', <handler>), may not get cleaned up (if "res" still remains there in
                //     memory due to any leak). Ensure a timer to handle such cases (and add appropriate log entries),
                //     otherwise, the server memory would get clogged.
                res.on('finish', function () {
                    let responseStatus;
                    try {
                        responseStatus = res._header.split('\n')[0].trim(); // ".trim()" is required, otherwise, "\r" entry might remain there.
                        responseStatus = responseStatus.replace('HTTP/1.1', '').trim();
                    } catch (e) {
                        responseStatus = 'Error: Unexpected error in response status. This should never happen.';
                    }
                    logger.verbose(
                        req.method + ' ' +
                        req.originalUrl + ' ' +
                        responseStatus
                    );
                });
            }

            next();
        });

        const receivedConfig = config || {};

        // Just a block
        {
            const config = extend(true, {}, receivedConfig);

            const
                _serverConfig = config.server || {},
                _accessConfig = _serverConfig.access || {},
                _serverUrlConfig = _accessConfig.url || {},
                _httpServerConfig = _serverUrlConfig.http || {},
                _httpsServerConfig = _serverUrlConfig.https || {},
                _httpsSecretsAndSettings = _httpsServerConfig.secretsAndSettings || {},
                _accessSecurityConfig = _accessConfig.security || {};

            // const
            //     _devToolsConfig = _serverConfig.devTools || {};

            const
                useHttps = _httpsServerConfig.enabled;

            const
                _nonProductionDevToolsConfig = _serverConfig.nonProductionDevTools || {};

            if (_serverConfig.verbose) {
                logger.info('Config being used:');
                logger.data(config);
            }

            const staticDir = _accessConfig.publicDirectory;

            const _loggerConfig = _serverConfig.logger;
            if (_loggerConfig && (_loggerConfig.showLogLine || {}).enabled) {
                global._noteDown_showLogLine = true;
                if (!_loggerConfig.showLogLine.showRelativePath) {
                    global._noteDown_basePath = projectRootFullPath;
                }
            }

            const networkDelayRange = _nonProductionDevToolsConfig.networkDelay || {};
            exp.use(networkDelay(networkDelayRange.minimum, networkDelayRange.maximum));

            exp.use(compression());

            if (_httpServerConfig.redirectToHttps) {
                exp.use(redirectToHttps({
                    httpsPort: _httpsServerConfig.port,
                    httpPort: _httpServerConfig.port,
                    redirectStatus: 307
                }));
            }

            if (_serverUrlConfig.redirectToWww) {
                exp.use(redirectToWww(307));
            }

            const helmetConfig = {};
            if (!useHttps || _nonProductionDevToolsConfig.skipHSTS) {
                // We may wish to disable HSTS to run "https" on different ports
                // If we don't disable HSTS, then browsers may cache the information
                // and internally redirect from "http" to "https" without checking with the server.
                // This becomes problematic when the "http" server is running on a custom port because
                // the browser's internal redirect to "https" would attempt to use that same port
                // which would not have "https".
                // Since, in production, there won't be any custom port, using HSTS would work well.
                // References:
                //     * https://superuser.com/questions/884997/my-chrome-jumps-to-non-existent-https-protocol/885100#885100
                //     * https://superuser.com/questions/304589/how-can-i-make-chrome-stop-caching-redirects/891464#891464
                //     * https://helmetjs.github.io/docs/hsts/
                helmetConfig.hsts = false;
            }
            if (!useHttps || _nonProductionDevToolsConfig.skipUpgradeInsecureRequests) {
                helmetConfig.contentSecurityPolicy = false;
            }
            // https://github.com/helmetjs/helmet#quick-start
            exp.use(helmet(helmetConfig));
            if (!useHttps || _nonProductionDevToolsConfig.skipUpgradeInsecureRequests) {
                exp.use(
                    helmet.contentSecurityPolicy({
                        directives: (function () {
                            const directivesToUse = {
                                ...helmet.contentSecurityPolicy.getDefaultDirectives()
                            };
                            delete directivesToUse['upgrade-insecure-requests'];
                            return directivesToUse;
                        })()
                    })
                );
            }

            if (staticDir) {
                const faviconPath = path.join(staticDir, 'favicon.ico');
                try {
                    exp.use(
                        favicon(
                            faviconPath,
                            {
                                // https://www.npmjs.com/package/serve-favicon#maxage
                                // Cache favicon for 1 week
                                maxAge: 7 * 24 * 60 * 60 * 1000
                            }
                        )
                    );
                } catch (e) {
                    console.warn(chalk.yellow('No favicon file found at path ', faviconPath));
                }
            }

            const hardCodedResponsesForDebugging = _nonProductionDevToolsConfig.hardCodedResponses;
            if (hardCodedResponsesForDebugging) {
                exp.use(hardCodedResponse({ verbose: true, conditions: hardCodedResponsesForDebugging, baseDir: projectRootFullPath, console: logger }));
            }

            if (_accessSecurityConfig.limitAccessWithBasicAuth) {
                // Authentication should be used after redirects are already done
                // (eg: redirecting to "www." should happen before authentication)
                exp.use(basicAuth({
                    skipPaths: [/^\/.well-known\/.+/]
                }));
            }

            // TODO: Add "exp.use(morgan('dev'));"

            /*
            (function (obscuredSourceMaps, exp) {
                if (obscuredSourceMaps) {
                    // Source maps (need to add HTTP header 'X-SourceMap' before serving the static files)
                    logger.help('Pass query string parameter "' + obscuredSourceMaps + '" in browser requests to activate source maps through header');
                    exp.use(function (req, res, next) {
                        if (req.url.indexOf('.bundle.') !== -1 && path.extname(req.url).split('?')[0] === '.js') {
                            let parsedUrl = req.headers.referer && url.parse(req.headers.referer, true);
                            parsedUrl = parsedUrl || url.parse(req.url, true);  // This would enable getting source-maps path in header by directly requesting the file with appropriate query string
                            if (parsedUrl && parsedUrl.query && parsedUrl.query[obscuredSourceMaps] !== undefined) {
                                res.setHeader('X-SourceMap', url.parse(req.url, true).pathname + '.' + obscuredSourceMaps + '.map');
                            }
                        }
                        next();
                    });
                }
            })(_devToolsConfig.obscuredSourceMaps, exp);
            /* */

            exp.use(
                matchRequest(
                    { conditions: [{ pattern: 'all' }], verbose: false, console: logger },
                    function (req, res, next) {
                        res.setHeader('Test', '123');
                        next();
                    }
                )
            );

            if (staticDir) {
                // Setting static server

                if (_accessConfig.serveDotWellKnownDirectoryForSslCertificate) {
                    exp.use(
                        '/.well-known',
                        express.static(
                            path.join(staticDir, '.well-known')
                        )
                    );
                }

                logger.info('Setting up static server for path ' + staticDir);
                exp.use(
                    express.static(
                        staticDir,
                        {
                            // "." folders should be not be accessible directly
                            dotfiles: 'ignore',

                            // TODO: In production mode, we should use appropriate caching
                            // maxAge: 0,

                            // https://github.com/expressjs/serve-static/issues/32#issuecomment-76226945
                            setHeaders: function (res, resourcePath) {
                                const numberOfSecondsInFifteenDays = 15 * 24 * 60 * 60;

                                if (resourcePath.indexOf('ensure-freshness') !== -1) {
                                    // Note:
                                    //     The Chrome DevTools do not necessarily show the real HTTP response status code.
                                    //     The following "Cache-Control" setting seems to work well for serving static
                                    //     files where "ensure-freshness" functionality is required (in development mode)
                                    res.setHeader('Cache-Control', 'public, max-age=' + (numberOfSecondsInFifteenDays) + ', no-cache');
                                } else if (resourcePath.match(/.*\.[0-9a-f]{20}\.(css|js)/)) {
                                    // Cache the requests matching the pattern *.<20-characters-of-hash>.<css/js>
                                    // https://stackoverflow.com/questions/5416250/regex-contains-at-least-8-decimal-digits#comment6129189_5416280
                                    res.setHeader('Cache-Control', 'public, max-age=' + (numberOfSecondsInFifteenDays));
                                } else {
                                    // TODO: In production mode, we should use appropriate caching
                                    res.setHeader('Cache-Control', 'public, max-age=0');
                                }
                            }
                        }
                    )
                );
            }

            // https://stackoverflow.com/questions/42128238/how-can-i-read-the-data-received-in-application-x-www-form-urlencoded-format-on/42129247#42129247
            exp.use(bodyParser.json()); // support json encoded bodies
            exp.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

            const router = await routeSetup(exp);

            const registerServer = function (protocol, portNumber, httpsConfig) {
                let server;
                if (protocol === 'http') {
                    server = http.createServer(exp);
                } else {
                    server = https.createServer(httpsConfig, exp);
                }

                const flagNotifyServerPathsOnLaunch = _nonProductionDevToolsConfig.flagNotifyServerPathsOnLaunch;

                server.listen(portNumber, function () {
                    logAndNotifyAboutServer({
                        protocol,
                        portNumber,

                        // If 'https' is being used, then don't notify about 'http' server
                        flagNotifyServerPathsOnLaunch: (useHttps ? false : flagNotifyServerPathsOnLaunch)
                    });
                });
                return server;
            };

            let useHttp = _httpServerConfig.enabled;
            const
                useHttpPortNumber = _httpServerConfig.port,
                useHttpsPortNumber = _httpsServerConfig.port;
            if (useHttps && useHttp && useHttpsPortNumber === useHttpPortNumber) {
                useHttp = false;
                logger.warn('Running in HTTPS mode only and not starting the HTTP mode (because both, HTTP and HTTPS are enabled, but have same port number in configuration)');
            }

            if (useHttps || useHttp) {
                // TODO: Fix the "eslint-disable-line no-unused-vars" used below
                let httpServerObject,
                    httpsServerObject;
                if (useHttps) {
                    // http://stackoverflow.com/questions/21397809/create-a-trusted-self-signed-ssl-cert-for-localhost-for-use-with-express-node/21398485#21398485
                    const httpsConfig = {
                        key: fs.readFileSync(path.join(projectRootFullPath, _httpsSecretsAndSettings.key)),
                        cert: fs.readFileSync(path.join(projectRootFullPath, _httpsSecretsAndSettings.cert))

                        // https://stackoverflow.com/questions/30957793/nodejs-ssl-bad-password-read/33291482#33291482
                        // Also see: http://blog.mgechev.com/2014/02/19/create-https-tls-ssl-application-with-express-nodejs/
                        // passphrase: _httpsSecretsAndSettings.passphrase,

                        // requestCert: _httpsSecretsAndSettings.requestCert,
                        // rejectUnauthorized: _httpsSecretsAndSettings.rejectUnauthorized
                    };
                    let ca = _httpsSecretsAndSettings.ca;
                    if (typeof ca === 'string') {
                        ca = [ca];
                    }
                    if (Array.isArray(ca)) {
                        // https://stackoverflow.com/questions/11744975/enabling-https-on-express-js/35628089#35628089
                        httpsConfig.ca = ca.map(function (certificate) {
                            return fs.readFileSync(path.join(projectRootFullPath, certificate));
                        });
                    }
                    httpsServerObject = registerServer('https', useHttpsPortNumber, httpsConfig); // eslint-disable-line no-unused-vars
                }
                if (useHttp) {
                    httpServerObject = registerServer('http', useHttpPortNumber);
                }

                if (_nonProductionDevToolsConfig.useLiveCssEditor) {
                    const liveCssServer = require('@webextensions/live-css');

                    // Start live-css server
                    liveCssServer({
                        expressApp: router,
                        httpServer: httpServerObject,
                        configFilePath: path.resolve(__dirname, '..', '.live-css.config.cjs')
                    });
                }
            } else {
                logger.fatal('Fatal error: HTTPS & HTTP, both the modes are disabled in the configuration. Exiting.');
                process.exit(1);
            }
        }
    }
};

export { application };
