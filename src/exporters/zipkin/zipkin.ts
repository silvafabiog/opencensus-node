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


import { Exporter } from "../exporter"
import { ZipkinOptions } from "./options"
import { RootSpan } from "../../trace/model/rootspan";
import * as http from "http";
import * as url from "url";
import { debug } from "../../internal/util";
import { Span } from "../../trace/model/span";

export class Zipkin implements Exporter {
    private zipkinUrl: url.UrlWithStringQuery;
    private serviceName: string;

    constructor(options: ZipkinOptions) {
        this.zipkinUrl = url.parse(options.url);
        this.serviceName = options.serviceName;
    }

    /**
     * @description send a trace to zipkin service
     * @param zipkinTrace trace translated to zipkin
     */
    private sendTrace(zipkinTrace) {
        // request options
        const options = {
            hostname: this.zipkinUrl.hostname,
            port: this.zipkinUrl.port,
            path: this.zipkinUrl.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        // build the request to zipkin service
        const req = http.request(options, (res) => {
            debug(`STATUS: ${res.statusCode}`);
            debug(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                debug(`BODY: ${chunk}`);
            });
            res.on('end', () => {
                debug('Finished request.');
            });
        });

        req.on('error', (e) => {
            debug(`problem with request: ${e.message}`);
        });

        // write data to request body
        let spansJson: string[] = zipkinTrace.map((span) => JSON.stringify(span));
        spansJson.join("");
        let outputJson: string = `[${spansJson}]`
        debug('Zipkins span list Json: %s', outputJson);

        //sendind the request
        req.write(outputJson);
        req.end();
    }

    /**
     * @description translate OpenSensus RootSpan to Zipkin Trace format
     * @param root
     */
    private translateTrace(root: RootSpan) {
        let spanList = []

        // Builds root span data
        const spanRoot = this.translateSpan(root)
        spanList.push(spanRoot);

        // Builds span data
        root.spans.forEach(span => {
            spanList.push(this.translateSpan(span));
        });

        return spanList;
    }

    /**
     * @description translate OpenSensus Span to Zipkin Span format
     * @param span
     * @param rootSpan optional
     */
    private translateSpan(span: Span | RootSpan, rootSpan?: RootSpan) {
        let spanTraslated = {};

        spanTraslated = {
            "traceId": span.traceId,
            "name": span.name,
            "id": span.id,
            "kind": "SERVER",
            "timestamp": (span.startTime.getTime() * 1000).toFixed(),
            "duration": (span.duration * 1000).toFixed(),
            "debug": true,
            "shared": true,
            "localEndpoint": {
                "serviceName": this.serviceName
            }
        }

        if (rootSpan) {
            spanTraslated["parentId"] = rootSpan.id;
        }

        return spanTraslated;
    }

    /**
     * @description send the rootSpans to zipkin service
     * @param rootSpans
     */
    publish(rootSpans: RootSpan[]) {
        rootSpans.forEach(trace => {
            this.sendTrace(this.translateTrace(trace));
        })
    }
}