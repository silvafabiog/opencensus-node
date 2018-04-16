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

import * as assert from 'assert';
import * as mocha from 'mocha';

import {Span,RootSpan,Tracer} from '../src/trace/model/types';
import { Exporter } from '../src/exporters/types';
import { TracerImpl } from '../src/trace/model/tracer';
import { RootSpanImpl } from '../src/trace/model/rootspan';
import { SpanImpl } from '../src/trace/model/span';


describe('Tracer', function () {
  const options = { name: "test" };
  const callback = (root) => { return root; }

  describe('new Tracer()', function () {
    it('should create a Tracer instance', function () {
      let tracer = new TracerImpl();
      assert.ok(tracer instanceof TracerImpl);
    });
  });

  describe('start()', function () {
    it('should return a tracer instance', function () {
      let tracer = new TracerImpl();
      let tracerStarted = tracer.start();
      assert.ok(tracerStarted instanceof TracerImpl);
    });

    it('the trace was started', function () {
      let tracer = new TracerImpl();
      let tracerStarted = tracer.start();
      assert.ok(tracerStarted.active);
    });
  });

  describe('startRootSpan()', function () {

    it('should start the rootSpan', function () {
      let tracer = new TracerImpl();
      tracer.start();
      let rootSpan = tracer.startRootSpan(options, callback);

      assert.ok(rootSpan.started);
    });
  });

  describe('end()', function () {
    it('should end current trace', function () {
      let tracer = new TracerImpl();
      let rootSpan = tracer.startRootSpan(options, callback);
      rootSpan.end();
      assert.ok(rootSpan.ended);
    });
  });

  describe('clearCurrentRootSpan()', function () {
    it('should set the current root span to null', function () {
      let tracer = new TracerImpl();
      let rootSpan = tracer.startRootSpan(options, callback);
      tracer.clearCurrentTrace();

      assert.ok(tracer.currentRootSpan == null);
    });
  });

  describe('startSpan()', function () {
    it('should return a Span instance', function () {
      let tracer = new TracerImpl();
      let rootSpan = tracer.startRootSpan(options, callback);
      let span = tracer.startSpan("spanName", "spanType");
      assert.ok(span instanceof SpanImpl);
    });

    it('should start a span', function () {
      let tracer = new TracerImpl();
      let rootSpan = tracer.startRootSpan(options, callback);
      let span = tracer.startSpan("spanName", "spanType");
      assert.ok(span.started);
    });
  });

});