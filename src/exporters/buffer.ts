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
const DEFAULT_BUFFER_SIZE = 3;
const DEFAULT_BUFFER_TIMEOUT = 20000; 
 
export class Buffer implements OnEndSpanEventListener { 
    private exporters: Exporter[]; 
    private bufferSize: Number; 
    private queue: RootSpan[]; 
    private bufferTimeout: number;
    private resetTimeout: boolean;
    private bufferTimeoutInProgress: boolean;
 
    constructor(bufferSize?: number, bufferTimeout?: number) { 
        this.queue = []; 
        this.bufferSize = bufferSize || DEFAULT_BUFFER_SIZE; 
        this.bufferTimeout = bufferTimeout || DEFAULT_BUFFER_TIMEOUT;
        this.exporters = [];
        this.resetTimeout = false;
        this.bufferTimeoutInProgress = false;
        return this; 
    } 
 
    setBufferSize(bufferSize: number) { 
        this.bufferSize = bufferSize; 
        return this; 
    } 
 
    registerExporter(exporter: Exporter) { 
        this.exporters.push(exporter); 
        return this; 
    } 
 
    onEndSpan(span) { 
        this.addToBuffer(span); 
        return this; 
    } 
 
    addToBuffer(trace: RootSpan) { 
        this.queue.push(trace); 
        debug("BUFFER: added new trace");
        if (this.queue.length > this.bufferSize) { 
            this.flush(); 
        } if (this.bufferTimeoutInProgress) {            
            this.resetBufferTimeout();
        } else {
            this.setBufferTimeout();
        }
        return this;
    }

    private resetBufferTimeout() {
        debug("BUFFER: reset timeout");
        this.resetTimeout = true;        
    }
    
    private setBufferTimeout() {
        debug("BUFFER: set timerout");
        this.bufferTimeoutInProgress = true;

        setTimeout(() => {
            if (this.queue.length == 0) {
                return;
            }
            
            if(this.resetTimeout) {
                this.resetTimeout = false;
                this.setBufferTimeout();
            } else {
                this.bufferTimeoutInProgress = false;
                this.flush();
            }
        }, this.bufferTimeout);
    }
 
    private flush() { 
        this.exporters.forEach(exporter => { 
            exporter.emit(this.queue) 
        }) 
        this.queue = []; 
        return this; 
    } 
}