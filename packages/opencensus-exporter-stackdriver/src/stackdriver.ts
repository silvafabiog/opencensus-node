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

import {JWT} from 'google-auth-library';
import {google} from 'googleapis';

import {debug} from '@opencensus/opencensus-core';
import {RootSpan} from '@opencensus/opencensus-core';
import {Buffer} from '@opencensus/opencensus-core';
import {Exporter} from '@opencensus/opencensus-core';
import {StackdriverOptions} from './options';

const cloudTrace = google.cloudtrace('v1');

interface SpanData {
  name: string;
  kind: string;
  spanId: string;
  startTime: string;
  endTime: string;
}

/** Format and sends span information to Stackdriver */
export class Stackdriver implements Exporter {
  projectId: string;
  buffer: Buffer;

  constructor(options: StackdriverOptions) {
    this.projectId = options.projectId;
    this.buffer = new Buffer(this, options.bufferSize, options.bufferTimeout);
  }

  /**
   * Is called whenever a span is ended.
   * @param root the ended span
   */
  onEndSpan(root: RootSpan) {
    this.buffer.addToBuffer(root);
  }

  /**
   * Publishes a list of root spans to Stackdriver.
   * @param rootSpans
   */
  publish(rootSpans: RootSpan[]) {
    const STACK_DRIVER_TRACES =
        rootSpans.map(trace => this.translateTrace(trace));
    this.authorize(this.sendTrace, STACK_DRIVER_TRACES);
  }

  /**
   * Translates root span data to Stackdriver's trace format.
   * @param root
   */
  private translateTrace(root: RootSpan) {
    const spanList = root.spans.map(span => this.translateSpan(span));
    spanList.push(this.translateSpan(root));

    return {
      'projectId': this.projectId,
      'traceId': root.traceId,
      'spans': spanList
    };
  }

  /**
   * Translates span data to Stackdriver's span format.
   * @param span
   */
  private translateSpan(span): SpanData {
    return {
      'name': span.name,
      'kind': 'SPAN_KIND_UNSPECIFIED',
      'spanId': span.id,
      'startTime': span.startTime,
      'endTime': span.endTime
    } as SpanData;
  }

  /**
   * Sends traces in the Stackdriver format to the service.
   * @param projectId
   * @param authClient
   * @param stackdriverTraces
   */
  private sendTrace(projectId, authClient, stackdriverTraces) {
    const request = {
      projectId,
      resource: {traces: stackdriverTraces},
      auth: authClient
    };
    cloudTrace.projects.patchTraces(request, err => {
      if (err) {
        debug(err);
        return;
      } else {
        debug('\nSENT TRACE:\n', request.resource);
      }
    });
  }

  /**
   * Gets the Google Application Credentials from the environment variables,
   * authenticates the client and calls a method to send the traces data.
   * @param sendTrace
   * @param stackdriverTraces
   */
  private authorize(sendTrace: Function, stackdriverTraces) {
    google.auth.getApplicationDefault((err, authClient: JWT, projectId) => {
      if (err) {
        console.error('authentication failed: ', err);
        return;
      }
      if (authClient.createScopedRequired &&
          authClient.createScopedRequired()) {
        const scopes = ['https://www.googleapis.com/auth/cloud-platform'];
        authClient = authClient.createScoped(scopes);
      }
      sendTrace(projectId, authClient, stackdriverTraces);
    });
  }
}