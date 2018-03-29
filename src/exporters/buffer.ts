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

import { debug } from '../internal/util'
import { Exporter } from './exporter'
import { google } from 'googleapis'
import { RootSpan } from '../trace/model/rootspan'
import { OnEndSpanEventListener } from '../trace/types/tracetypes'
import { ExporterOptions } from './exporterOptions';

// TODO: Implement default size based on application size
const DEFAULT_BUFFER_SIZE = 0;

export class Buffer implements OnEndSpanEventListener {
    _exporters: Exporter[];
    _bufferSize: Number;
    _queue: RootSpan[];

    constructor(bufferSize?: number) {
        this._queue = [];
        this._bufferSize = bufferSize || DEFAULT_BUFFER_SIZE;
        this._exporters = [];
        return this;
    }

    public setBufferSize(bufferSize: number) {
        this._bufferSize = bufferSize;
        return this;
    }

    public registerExporter(exporter: Exporter) {
        this._exporters.push(exporter);
        return this;
    }

    public onEndSpan(span) {
        this.addToBuffer(span);
        return this;
    }

    public addToBuffer(trace: RootSpan) {
        this._queue.push(trace);
        if (this._queue.length > this._bufferSize) {
            this.flush();
        }
        return this;
    }

    private flush() {
        this._exporters.forEach(exporter => {
            exporter.emit(this._queue)
        })
        this._queue = [];
        return this;
    }
}