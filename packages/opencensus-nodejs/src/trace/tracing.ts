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

import  * as extend from 'extend';
import {RootSpan, SamplerImpl, TracerImpl, PluginNames} from '@opencensus/opencensus-core';
import {Span} from '@opencensus/opencensus-core';
import {debug} from '@opencensus/opencensus-core';
import {Tracer} from '@opencensus/opencensus-core';
import {Tracing} from '@opencensus/opencensus-core';
import {Sampler} from '@opencensus/opencensus-core';
import {ConsoleLogExporter, Exporter, NoopExporter} from '@opencensus/opencensus-core';
import {Config} from '@opencensus/opencensus-core';

import {PluginLoader} from './instrumentation/plugingloader';

import {defaultConfig} from './config/config'
import {Constants} from './constants';




export class TracingImpl implements Tracing {

  private active: boolean;
  private tracerLocal: Tracer;
  private pluginLoader: PluginLoader;
  private defaultPlugins: PluginNames;
  private config: Config;


  private static sgltnInstance: Tracing;

  constructor() {
    this.tracerLocal = new TracerImpl();
    this.pluginLoader = new PluginLoader(this.tracerLocal);
    this.defaultPlugins = PluginLoader.defaultPluginsFromArray(Constants.DEFAULT_INSTRUMENTATION_MODULES);
  }

  static get instance() {
    return this.sgltnInstance || (this.sgltnInstance = new this());
  }

  /**
   * start - description
   *
   * @return {type}  description
   */
  start(userConfig?: Config): Tracing {

    this.config = extend(
      true, {}, defaultConfig, {plugins: this.defaultPlugins}, userConfig);

    debug("config: %o", this.config);

    this.pluginLoader.loadPlugins(this.config.plugins);

    if(!this.config.exporter) {
      let exporter = new ConsoleLogExporter(this.config);
      this.tracerLocal.registerEndSpanListener(exporter);
    }   
    this.active = true;
    this.tracerLocal.start(this.config);
    return this;
  }

  /**
   * stop - description
   *
   * @return {type}  description
   */
  stop() {
    this.active = false;
    this.tracerLocal.stop();
  }

  get tracer(): Tracer {
    return this.tracerLocal;
  }

  get exporter(): Exporter {
    return this.config.exporter;
  }

  /**
   * Registers an exporter to send the collected traces to.
   * @param exporter THe exporter to send the traces to.
   */
  registerExporter(exporter: Exporter): Tracing {
    this.config.exporter = exporter;
    this.tracer.registerEndSpanListener(exporter);
    return this;
  }
}
