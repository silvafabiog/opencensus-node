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

import * as uuidv4 from 'uuid/v4';

import { debug } from '../../../internal/util'
import { TraceContext, SpanBaseModel } from '../../types/tracetypes'
import { Sampler } from '../../config/sampler'

const X_B3_TRACE_ID = 'x-b3-traceid';
const X_B3_SPAN_ID = 'x-b3-spanid';
const X_B3_PARENT_SPAN_ID = 'x-x3-parentspanid';
const X_B3_SAMPLED = 'x-b3-sampled';

const SAMPLED_VALUE = "1";

export class B3Format {

    constructor() { }

    static extractFromHeader(headers: object): TraceContext {
        if (headers) {
            let traceContext = <TraceContext>{
                traceId: headers[X_B3_TRACE_ID],
                spanId: headers[X_B3_SPAN_ID],
                parentSpanId: headers[X_B3_PARENT_SPAN_ID],
            }
            if (headers[X_B3_SAMPLED] && headers[X_B3_SAMPLED] == SAMPLED_VALUE) {
                traceContext.sampleDecision = true
            } else {
                traceContext.sampleDecision = false
            }
            return traceContext
        }
        return null;
    }

    static injectToHeader(headers: object, span: SpanBaseModel): object {
        const sampler = new Sampler();
        
        let b3Header = {
            'x-b3-traceid': span && span.traceId || 'undefined',
            'x-b3-spanid': span && span.id || 'undefined',
            'x-x3-parentspanid': span && span.getParentSpanId() || 'undefined',
        }
        if (span) {
            b3Header['x-b3-sampled'] = SAMPLED_VALUE;
        }
        return Object.assign(headers || {}, b3Header);
    }
}