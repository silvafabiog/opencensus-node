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

import { RootSpan, SamplerImpl, TracerImpl } from '@opencensus/opencensus-core'
import { Span } from '@opencensus/opencensus-core'
import { PluginLoader } from './instrumentation/plugingloader'
import { debug } from '@opencensus/opencensus-core'
import { Buffer } from '@opencensus/opencensus-core'
import { Tracer } from '@opencensus/opencensus-core'
import { Tracing } from '@opencensus/opencensus-core'
import { Sampler } from '@opencensus/opencensus-core'
import { ExporterOptions } from '@opencensus/opencensus-core'
import { Exporter, NoopExporter, ConsoleLogExporter } from '@opencensus/opencensus-core'


export class TracingImpl implements Tracing {

    private samplerLocal: Sampler;
    private active_: Boolean;
    private tracerLocal: Tracer;
    private exporterLocal: Exporter;
    private buffer: Buffer;
    private pluginLoader: PluginLoader;

    readonly PLUGINS = ['http', 'https', 'mongodb-core']

    private static sgltn_instance: Tracing;

    constructor() {
        this.tracerLocal = new TracerImpl();
        this.pluginLoader = new PluginLoader(this.tracerLocal);
        this.samplerLocal = new SamplerImpl();

    }

    public static get instance() {
        return this.sgltn_instance || (this.sgltn_instance = new this());
    }

    /**
     * start - description
     *
     * @return {type}  description
     */
    start(): Tracing {

        if (this.tracerLocal.eventListeners.length > 0) {
            this.exporterLocal = new ConsoleLogExporter();
            const buffer = new Buffer().registerExporter(this.exporterLocal);
            this.tracerLocal.registerEndSpanListener(buffer);
        }
        this.pluginLoader.loadPlugins(PluginLoader.getDefaultPackageMap(this.PLUGINS));
        this.active_ = true;
        this.tracerLocal.start();
        return this;
    }


    /**
     * stop - description
     *
     * @return {type}  description
     */
    stop() {
        this.active_ = false;
        this.tracerLocal.stop();
    }

    get tracer(): Tracer {
        return this.tracerLocal;
    }

    get sampler() : Sampler {
        return this.samplerLocal;
    }

    get exporter(): Exporter {
        return this.exporterLocal;
    }

}
