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

import * as fs from 'fs'
import * as path from 'path'
import * as hook from 'require-in-the-middle';

import {Tracer} from '@opencensus/opencensus-core';
import {Plugin} from '@opencensus/opencensus-core';
import {PluginNames} from '@opencensus/opencensus-core';
import {debug} from '@opencensus/opencensus-core';
import {Constants} from '../constants';

/**
 *
 */
export class PluginLoader {

  private tracer: Tracer;
  private plugins: Plugin[] = [];

  constructor(tracer: Tracer) {
    this.tracer = tracer;
  }

   private static defaultPackageName(moduleName): string {
    return `${Constants.SCOPE}/${Constants.PLUGIN_PACKAGE_NAME_PREFIX}-${moduleName}`;
  }


  static defaultPluginsFromArray(modulesToPatch: string[]): PluginNames  {
    var plugins = modulesToPatch.reduce((plugins, moduleName) => {
      plugins[moduleName] = PluginLoader.defaultPackageName(moduleName);
      return plugins;
    }, {});
    return plugins;
  }


  /**
   * private getPlugingImportPath - description
   *
   * @param  {type} pkgname: string description
   * @param  {type} name:string     description
   * @return {type}                 description
   */
  private getPlugingImportPath(pkgname: string, name: string) {
    return path.join(pkgname, 'build', 'src', name);
  }


  /**
   * private getPackageVersion - description
   *
   * @param  {type} name:string    description
   * @param  {type} basedir:string description
   * @return {type}                description
   */
  private getPackageVersion(name: string, basedir: string) {
    let version = null;
    if (basedir) {
      let pkgJson = path.join(basedir, 'package.json')
      try {
        version = JSON.parse(fs.readFileSync(pkgJson).toString()).version
      } catch (e) {
        debug('could not get version of %s module: %s', name, e.message)
      }
    } else {
      version = process.versions.node
    }
    return version;
  }


  /**
   * loadPlugins - description
   *
   * @param  {type} pluginList: Map<string description
   * @param  {type} string>               description
   * @return {type}                       description
   */
  loadPlugins(pluginList: PluginNames) {
    let self = this;

    hook(Object.keys(pluginList), (exports, name, basedir) => {
      let version = self.getPackageVersion(name, basedir);
      if (!version) {
        return exports;
      } else {
        debug('applying patch to %s@%s module', name, version)
        debug('using package %s to patch %s', pluginList[name], name);
        let pluginImportPath = self.getPlugingImportPath(pluginList[name], name);
        let plugin: Plugin = require(pluginImportPath);
        self.plugins.push(plugin);
        return plugin.applyPatch(exports, self.tracer, version);
      }
    })
  }


  /**
   * unloadPlugins - description
   *
   * @return {type}  description
   */
  unloadPlugins() {
    this.plugins.forEach((plugin: Plugin) => {
      plugin.applyUnpatch();
    });
    this.plugins = [];
  }

}
