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

import { RootSpan } from '@opencensus/opencensus-core'
import { Span } from '@opencensus/opencensus-core'
import { PluginLoader } from './instrumentation/plugingloader'
import { debug } from '@opencensus/opencensus-core'
import { Buffer } from '@opencensus/opencensus-core'
import { Tracer } from '@opencensus/opencensus-core'
import { Sampler } from '@opencensus/opencensus-core'
import { ExporterOptions } from '@opencensus/opencensus-core'
import { Exporter, NoopExporter, ConsoleLogExporter } from '@opencensus/opencensus-core'

//TODO: Review dependecies
//import { Stackdriver } from '../exporters/stackdriver/stackdriver'
//import { StackdriverOptions } from '../exporters/stackdriver/options'
//import { Zipkin } from '../exporters/zipkin/zipkin'
//import { ZipkinOptions } from '../exporters/zipkin/options'


export type Func<T> = (...args: any[]) => T;


//TODO: Add comments 

export class Tracing {

    private sampler: Sampler;
    private active_: Boolean;
    private tracer: Tracer;
    private exporter: Exporter;
    private buffer: Buffer;
    private pluginLoader: PluginLoader;

    readonly PLUGINS = ['http', 'https', 'mongodb-core']

    private static sgltn_instance: Tracing;

    constructor() {
        this.tracer = new Tracer();
        this.pluginLoader = new PluginLoader(this.tracer);
        this.sampler = new Sampler();

    }


    public static get instance() {
        return this.sgltn_instance || (this.sgltn_instance = new this());
    }

    /**
     * @description
     */
    start(): Tracing {
        if (this.tracer.getEventListeners.length > 0) {
            this.exporter = new ConsoleLogExporter();
            const buffer = new Buffer().registerExporter(this.exporter);
            this.tracer.registerEndSpanListener(buffer);
        }
        this.pluginLoader.loadPlugins(this.PLUGINS);
        this.active_ = true;
        this.tracer.start();
        return this;
    }

    stop() {
        this.active_ = false;
        this.tracer.stop();
    }

    get Tracer(): Tracer {
        return this.tracer;
    }

    get Sampler() : Sampler {
        return this.sampler;
    }

    get Exporter(): Exporter {
        return this.exporter;
    }

    /**
     * @description
     * @param projectId
     * @param bufferSize
     */
    /*addStackdriver(projectId: string, bufferSize?: number): Tracing {
        const stackdriverOptions = new StackdriverOptions(projectId);
        const exporter = new Stackdriver(stackdriverOptions);

        const buffer = new Buffer(bufferSize).registerExporter(exporter);
        this.tracer.registerEndSpanListener(buffer);
        return this;
    }*/

    /**
     * @description register zipkin driver
     * @param zipkinUrl url from zipkin service, including the port and path. E.g.: http://localhost:9411/api/v2/spans
     * @param serviceName name of the service that will appear in the zipkin service
     */
    /*addZipkin(zipkinUrl: string, serviceName: string): Tracing {
        const zipkinOptions = new ZipkinOptions(zipkinUrl, serviceName);
        const exporter = new Zipkin(zipkinOptions);

        const buffer = new Buffer().registerExporter(exporter);
        this.tracer.registerEndSpanListener(buffer);
        return this;
    }*/
}

