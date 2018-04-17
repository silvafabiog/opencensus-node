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

import * as uuid from 'uuid';

import {Clock} from '../../internal/clock';
import {debug} from '../../internal/util';

import {SpanImpl} from './span';
import {SpanBaseModel} from './spanbasemodel';
import {TracerImpl} from './tracer';
import {OnEndSpanEventListener, RootSpan, Span, TraceContext, TraceOptions, Tracer} from './types';

/** Defines a root span */
export class RootSpanImpl extends SpanBaseModel implements RootSpan {
  private tracer: Tracer;
  private spansLocal: Span[];
  private traceIdLocal: string;

  // TODO - improve root name setup
  constructor(tracer: Tracer, context?: TraceOptions) {
    super();
    this.tracer = tracer;
    this.traceIdLocal =
        context && context.traceContext && context.traceContext.traceId ?
        context.traceContext.traceId :
        (uuid.v4().split('-').join(''));
    this.name = context && context.name ? context.name : 'undefined';
    if (context && context.traceContext) {
      this.parentSpanId = context.traceContext.spanId || '';
    }
    this.spansLocal = [];
  }

  /** Get span list from rootspan instance */
  get spans(): Span[] {
    return this.spansLocal;
  }

  /** Get trace id from rootspan instance */
  get traceId(): string {
    return this.traceIdLocal;
  }

  /** Start a rootspan instance */
  start() {
    super.start();
    debug(
        'starting %s  %o', this.className,
        {traceId: this.traceId, id: this.id, parentSpanId: this.parentSpanId});
  }

  /** End a rootspan instance */
  end() {
    super.end();

    // TODO - Define logic for list of spans
    for (const span of this.spansLocal) {
      if (span.ended || !span.started) return;
      span.truncate();
    }

    this.tracer.onEndSpan(this);
  }

  /**
   * Event called when a span ended
   * @param span Span ended
   */
  onEndSpan(span: Span) {
    debug('ending span  %o', {
      id: span.id,
      traceId: span.traceId,
      name: span.name,
      startTime: span.startTime,
      endTime: span.endTime,
      duration: span.duration
    });
  }

  /**
   * Start a new span linked with the rootspan
   * @param name Span name
   * @param type Span type
   * @param parentSpanId Span parent ID
   */
  startSpan(name: string, type: string, parentSpanId?: string) {
    if (!this.started) {
      debug(
          'calling %s.startSpan() on un-started %s %o', this.className,
          this.className, {id: this.id, name: this.name, type: this.type});
      return;
    }
    if (this.ended) {
      debug(
          'calling %s.startSpan() on ended %s %o', this.className,
          this.className, {id: this.id, name: this.name, type: this.type});
      return;
    }
    const newSpan = new SpanImpl(this);
    if (name) {
      newSpan.name = name;
    }
    if (type) {
      newSpan.type = type;
    }
    newSpan.start();
    this.spansLocal.push(newSpan);
    return newSpan;
  }
}
