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
import * as url from 'url'
import * as eos from 'end-of-stream'
import { Tracer } from '@opencensus/opencensus-core'
import { debug } from '@opencensus/opencensus-core'
import { Plugin, BasePlugin } from '@opencensus/opencensus-core'


class MongoDBPlugin extends BasePlugin implements Plugin {

  readonly SERVER_FNS = ['insert', 'update', 'remove', 'auth']
  readonly CURSOR_FNS_FIRST = ['_find', '_getmore']
  readonly SPAN_MONGODB_QUERY_TYPE = 'db.mongodb.query'

  constructor() {
    super('mongodb-core');
  }

  public applyPatch(exporter: any, tracer: Tracer, version: string) {
    this.setPluginContext(exporter, tracer, version);

    if (!semver.satisfies(version, '>=1.2.19 <4.0.0')) {
      debug('mongodb-core version %s not supported - aborting...', version)
      return exporter
    }

    if (exporter.Server) {
      debug('patching mongodb-core.Server.prototype.command')
      this.wrap(exporter.Server.prototype, 'command', this.patchCommand(this))
      debug('patching mongodb-core.Server.prototype functions:', this.SERVER_FNS)
      this.massWrap(exporter.Server.prototype, this.SERVER_FNS, this.patchQuery(this))
    }

    if (exporter.Cursor) {
      debug('patching mongodb-core.Cursor.prototype functions:', this.CURSOR_FNS_FIRST)
      this.massWrap(exporter.Cursor.prototype, this.CURSOR_FNS_FIRST, this.patchCursor(this))
    }

    return exporter
  }

  applyUnpatch(): void {
    this.unwrap(this.exporter.Server.prototype, 'command');
    this.massUnwrap(this.exporter.Server.prototype, this.SERVER_FNS);
    this.massUnwrap(this.exporter.Cursor.prototype, this.CURSOR_FNS_FIRST);
 }

  patchCommand(self: MongoDBPlugin) {
    return function (orig) {
      return function (ns, cmd) {
        var root = self.tracer.currentRootSpan
        var id = root && root.id
        var span

        //debug('New mongodb span for rootSpan %o', { traceId: root.traceId, name: root.name })
        debug('intercepted call to mongodb-core.Server.prototype.command %o', { id: id, ns: ns })

        if (root && arguments.length > 0) {
          var index = arguments.length - 1
          var cb = arguments[index]
          if (typeof cb === 'function') {
            var type
            if (cmd.findAndModify) type = 'findAndModify'
            else if (cmd.createIndexes) type = 'createIndexes'
            else if (cmd.ismaster) type = 'ismaster'
            else if (cmd.count) type = 'count'
            else type = 'command'

            arguments[index] = wrappedCallback
            span = self.tracer.startSpan(ns + '.' + type, self.SPAN_MONGODB_QUERY_TYPE)
          }
        }

        return orig.apply(this, arguments)

        function wrappedCallback() {
          debug('intercepted mongodb-core.Server.prototype.command callback %o', { id: id })
          span.end()
          return cb.apply(this, arguments)
        }
      }
    }
  }


  patchQuery(self: MongoDBPlugin) {
    return function (orig, name) {
      return function (ns) {
        var root = self.tracer.currentRootSpan
        var id = root && root.id
        var span

        // debug('New mongodb span for rootSpan %o', { traceId: root.traceId, name: root.name })
        debug('intercepted call to mongodb-core.Server.prototype.%s %o', name, { id: id, ns: ns })

        if (root && arguments.length > 0) {
          var index = arguments.length - 1
          var cb = arguments[index]
          if (typeof cb === 'function') {
            arguments[index] = wrappedCallback
            span = self.tracer.startSpan(ns + '.' + name, self.SPAN_MONGODB_QUERY_TYPE)
          }
        }

        return orig.apply(this, arguments)

        function wrappedCallback() {
          debug('intercepted mongodb-core.Server.prototype.%s callback %o', name, { id: id })
          span.end()
          return cb.apply(this, arguments)
        }
      }
    }
  }

  patchCursor(self: MongoDBPlugin) {
    return function (orig, name) {
      return function () {
        var root = self.tracer.currentRootSpan
        var id = root && root.id
        var span

        // debug('New mongodb span for rootSpan %o', { traceId: root.traceId, name: root.name })
        debug('intercepted call to mongodb-core.Cursor.prototype.%s %o', name, { id: id })

        if (root && arguments.length > 0) {
          var cb = arguments[0]
          if (typeof cb === 'function') {
            arguments[0] = wrappedCallback
            span = self.tracer.startSpan(this.ns + '.' + (this.cmd.find ? 'find' : name), self.SPAN_MONGODB_QUERY_TYPE)
          }
        }

        return orig.apply(this, arguments)

        function wrappedCallback() {
          debug('intercepted mongodb-core.Cursor.prototype.%s callback %o', name, { id: id })
          span.end()
          return cb.apply(this, arguments)
        }
      }
    }
  }
}

module.exports = new MongoDBPlugin();


