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

import {ExporterOptions} from '@opencensus/opencensus-core';
/**
 * This class represents the options from stackdriver
 */
export class StackdriverOptions implements ExporterOptions {
  projectId: string;
  bufferSize?: number;
  bufferTimeout?: number;

  /**
   * Constructor of StackdriverOptions class.
   * @param projectId project id defined to stackdriver
   * @param bufferSize optional parameter, defines the buffer size
   */
  constructor(projectId: string, bufferSize?: number, bufferTimeout?: number) {
    this.projectId = projectId;
    this.bufferSize = bufferSize;
    this.bufferTimeout = bufferTimeout;
  }
}