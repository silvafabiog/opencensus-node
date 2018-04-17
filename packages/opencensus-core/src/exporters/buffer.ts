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

import {debug} from '../internal/util';
import {RootSpan} from '../trace/model/types';
import {OnEndSpanEventListener} from '../trace/model/types';

import {Exporter} from './types';
import {Config, BufferConfig} from '../trace/config/types';


/**
 * Controls the sending of traces to exporters
 */
export class Buffer {
  private exporter: Exporter;
  private bufferSize: number;
  /** Trace queue of a buffer */
  private queue: RootSpan[] = [];
  /** Max time for a buffer can wait before being sent */
  private bufferTimeout: number;
  /** Manage when the buffer timeout needs to be reseted */
  private resetTimeout: boolean = false;
  /** Indicates when the buffer timeout is running */
  private bufferTimeoutInProgress: boolean = false;

  constructor(exporter: Exporter, config: BufferConfig) {
    this.exporter = exporter;
    this.bufferSize = config.bufferSize;
    this.bufferTimeout = config.bufferTimeout;
    return this;
  }

  /**
   * Set the buffer size value
   * @param bufferSize The new buffer size
   */
  setBufferSize(bufferSize: number) {
    this.bufferSize = bufferSize;
    return this;
  }

  /**
   * Add a trace (rootSpan) in the buffer
   * @param trace RootSpan to be added in the buffer
   */
  addToBuffer(trace: RootSpan) {
    this.queue.push(trace);
    debug('BUFFER: added new trace');

    if (this.queue.length > this.bufferSize) {
      this.flush();
    }

    if (this.bufferTimeoutInProgress) {
      this.resetBufferTimeout();
    } else {
      this.setBufferTimeout();
    }

    return this;
  }

  /** Reset the buffer timeout */
  private resetBufferTimeout() {
    debug('BUFFER: reset timeout');
    this.resetTimeout = true;
  }

  /** Start the buffer timeout, when finished calls flush method */
  private setBufferTimeout() {
    debug('BUFFER: set timerout');
    this.bufferTimeoutInProgress = true;

    setTimeout(() => {
      if (this.queue.length === 0) {
        return;
      }

      if (this.resetTimeout) {
        this.resetTimeout = false;
        this.setBufferTimeout();
      } else {
        this.bufferTimeoutInProgress = false;
        this.flush();
      }
    }, this.bufferTimeout);
  }

  /** Send the trace queue to all exporters */
  private flush() {
    this.exporter.publish(this.queue);
    this.queue = [];
    return this;
  }
}