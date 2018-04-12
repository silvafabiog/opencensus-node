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

import { Tracer } from '@opencensus/opencensus-core'
import { debug } from '@opencensus/opencensus-core'
import { Plugin, BasePlugin } from '@opencensus/opencensus-core'
import { TraceOptions, TraceContext } from '@opencensus/opencensus-core';
import { B3Format } from '@opencensus/opencensus-propagation-b3'


export class HttpPlugin extends BasePlugin<Tracer> implements Plugin<Tracer> {

    constructor() {
        super('http');
    }

    public applyPatch(http: any, tracer: Tracer, version: string) {

        this.setPluginContext(http, tracer, version);

        debug('patching http.Server.prototype.emit function')
        shimmer.wrap(http && http.Server && http.Server.prototype, 'emit', this.patchHttpRequest(this))

        debug('patching http.request function')
        shimmer.wrap(http, 'request', this.patchOutgoingRequest(this))

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

                    let options = <TraceOptions>{
                        name: arguments[1].method + ' ' + arguments[1].url,
                        type: arguments[1].method,
                        traceContext: B3Format.extractFromHeader(arguments[1].headers)
                    }

                    // Make sure we do not create a trace that was not sampled
                    if (options.traceContext && !options.traceContext.sampleDecision) {
                        return orig.apply(this, arguments)
                    }

                    return self.tracer.startRootSpan(options, (root) => {
                        let method = req.method || 'GET';

                        if (!root) {
                            return orig.apply(this, arguments)
                        }

                        //TODO: review this logic maybe and request method
                        debug('root.name = %s, http method = $s', root.name, method)

                        self.tracer.wrapEmitter(req);
                        self.tracer.wrapEmitter(res);

                        eos(res, function (err) {
                            if (!err) {
                                return root.end()
                            }
                        })
                        return orig.apply(this, arguments)
                    })
                } else {
                    return orig.apply(this, arguments)
                }
            }
        }
    }

    patchOutgoingRequest (self: HttpPlugin) {
        var spanType = 'ext.' + self.moduleName + '.http'
  
        return function (orig) {
          return function () {
          
            var req = orig.apply(this, arguments)
            var name = req.method + ' ' + req._headers.host + url.parse(req.path).pathname
  
            //TODO only for tests. Remove and implement a blacklist
            if (name.indexOf('googleapi') < 0) {
              var span = self.tracer.startSpan(name, spanType)
              var id = span.id && span.traceId
            }
  
            if (!span) return req
            req.on('response', onresponse)
  
            return req
  
            function onresponse (res) {
 
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
  
              function onEnd () {
                //debug('intercepted http.IncomingMessage end event %o', {id: id})
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

