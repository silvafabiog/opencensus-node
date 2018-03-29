/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as semver from 'semver'
import * as shimmer from 'shimmer'
import * as url from 'url'
import * as eos from 'end-of-stream'

import { Tracer } from '../model/tracer'
import { debug } from '../../internal/util'
import { Plugin, BasePlugin } from './plugingtypes'

/*
module.exports = {
  TraceId: 'X-B3-TraceId',
  SpanId: 'X-B3-SpanId',
  ParentSpanId: 'X-B3-ParentSpanId',
  Sampled: 'X-B3-Sampled',
  Flags: 'X-B3-Flags'
}; 

function appendZipkinHeaders(req, traceId) {
  const headers = req.headers || {};
  headers[HttpHeaders.TraceId] = traceId.traceId;
  headers[HttpHeaders.SpanId] = traceId.spanId;

  traceId._parentId.ifPresent(psid => {
    headers[HttpHeaders.ParentSpanId] = psid;
  });
  traceId.sampled.ifPresent(sampled => {
    headers[HttpHeaders.Sampled] = sampled ? '1' : '0';
  });

  return headers;
}

function addZipkinHeaders(req, traceId) {
  const headers = appendZipkinHeaders(req, traceId);
  return Object.assign({}, req, {headers});
}

*/

export class HttpPlugin extends BasePlugin<Tracer> implements Plugin<Tracer> {

    constructor() {
        super('http');
    }

    public applyPatch(http: any, tracer: Tracer, version: string) {

        this.setPluginContext(http, tracer, version);

        debug('patching http.Server.prototype.emit function')
        shimmer.wrap(http && http.Server && http.Server.prototype, 'emit', this.patchHttpRequest(this))

        debug('patching http.request function')
        shimmer.massWrap([http], ['request', 'get'], this.patchOutgoingRequest(this))

        debug('patching http.ServerResponse.prototype.writeHead function')
        shimmer.wrap(http && http.ServerResponse && http.ServerResponse.prototype, 'writeHead', this.patchWriteHead(this))

        return http
    }


    patchHttpRequest(self: HttpPlugin) {
        return function (orig) {
            return function (event, req, res) {
                debug('intercepted request event %s', event)
                if (event === 'request') {
                    debug('intercepted request event call to %s.Server.prototype.emit', self.moduleName)
                    let method = req.method || 'GET';
                    
                    let span = self.tracer.startRootSpan();
                    span.name = method + ' ' + (req.url ? (url.parse(req.url).pathname || '/') : '/');
                    span.type = 'request'
                    
                    //debug('span.name = %s, http method = $s', span.name, method)

                    // TODO Check if header exists, if so, checks if TraceContext exists
                    // TODO Decide between creating a rootSpan or span (passing the context)
                    // TODO Make sure you are sending the info right
                    //debug('created trace %o', {id: trace.traceId, name: trace.name, startTime: trace.startTime})
                    
                    eos(res, function (err) {
                        if (!err) return span.end()
                        // Handle case where res.end is called after an error occurred on the
                        // stream (e.g. if the underlying socket was prematurely closed)
                        res.on('prefinish', function () {
                            span.end()
                        })
                    })

                    //debug('REQUEST ARGUMENTS | patch http request', arguments)
                }
                return orig.apply(this, arguments)
            }
        }
    }

    patchOutgoingRequest(self: HttpPlugin) {
        return function (orig) {
            return function () {
                let span = self.tracer.startSpan() || self.tracer.startRootSpan();

                let b3Header = {
                    'X-B3-TraceId': span.traceId,
                    'X-B3-ParentSpanId': span.traceId,    // TODO get parent span
                    'X-B3-SpanId': span.id,
                    'X-B3-Sampled': true                  // TODO get sample decision
                }

                // Parses string url into url object
                if (arguments[0] instanceof String) {
                    arguments[0] = url.parse(arguments[0]);
                }

                // Do not track ourselves
                if (arguments[0].hostname.indexOf('googleapis') < 0) {
                    if (!arguments[0].headers) {
                        arguments[0].headers = b3Header;
                    } else {
                        arguments[0].headers = Object.assign(arguments[0]['headers'], b3Header);
                    }
                    //debug('REQUEST ARGUMENTS | patch outgoing request', arguments)
                }

                let req = orig.apply(this, arguments);

                span.name = req.method + ' ' + url.parse(req.path).pathname;
                span.type = 'request/get';

                let id = span.id && span.traceId

                debug('\n\nintercepted call to %s.request/get %o', self.moduleName, { id: id })

                req.on('response', onresponse)
                return req

                function onresponse(res) {
                    debug('intercepted http.ClientRequest response event %o', { id: id })

                    // Inspired by:
                    // https://github.com/nodejs/node/blob/9623ce572a02632b7596452e079bba066db3a429/lib/events.js#L258-L274
                    if (res.prependListener) {
                        // Added in Node.js 6.0.0
                        res.prependListener('end', onEnd)
                    } else {
                        var existing = res._events && res._events.end
                        if (!existing) {
                            res.on('end', onEnd)
                        } else {
                            if (typeof existing === 'function') {
                                res._events.end = [onEnd, existing]
                            } else {
                                existing.unshift(onEnd)
                            }
                        }
                    }

                    function onEnd() {
                        debug('intercepted http.IncomingMessage end event %o', { id: id })
                        span.end()
                    }
                }
            }
        }
    }

    patchWriteHead(self: HttpPlugin) {
        return function (orig) {
            return function () {
                var headers = arguments.length === 1
                    ? this._headers // might be because of implicit headers
                    : arguments[arguments.length - 1]

                var result = orig.apply(this, arguments)

                var root = self.tracer.currentRootSpan

                if (root) {
                    // It shouldn't be possible for the statusCode to be falsy, but just in
                    // case we're in a bad state we should avoid throwing
                    //  trace.result = 'HTTP ' + (this.statusCode || '').toString()[0] + 'xx'

                    // End transacton early in case of SSE
                    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
                        Object.keys(headers).some(function (key) {
                            if (key.toLowerCase() !== 'content-type') return false
                            if (String(headers[key]).toLowerCase().indexOf('text/event-stream') !== 0) return false
                            //debug('detected SSE response - ending trace %o', { id: trace.traceId })
                            root.end()
                            return true
                        })
                    }
                }
                return result
            }
        }
    }

}

module.exports = new HttpPlugin()

