/*
 * Copyright (c) Microsoft Corporation
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {get, isEmpty} from 'lodash';
import yaml from 'js-yaml';
import Joi from 'joi-browser';
import {jobProtocolSchema} from '../models/protocol-schema';
import {keyValueArrayReducer, removeEmptyProperties} from '../utils/utils';

export class JobProtocol {
  constructor(props) {
    const {name, jobRetryCount, prerequisites, parameters, taskRoles, deployments,
           description, contributor, secrets, defaults, extras} = props;
    this.protocolVersion = 2;
    this.name = name || '';
    this.description = description || '';
    this.contributor = contributor || '';
    this.type = 'job';
    this.jobRetryCount = jobRetryCount || 0;
    this.prerequisites = prerequisites || [];
    this.parameters = parameters || {};
    this.taskRoles = taskRoles || {};
    this.deployments = deployments || {};
    this.secrets = secrets || {};
    this.defaults = defaults || {};
    this.extras = extras || {};
  }

  static fromYaml(protocolYaml) {
    try {
      const jobProtocol = yaml.safeLoad(protocolYaml);
      // Need to validate the protocol here.
      return new JobProtocol(jobProtocol);
    } catch (e) {
      alert(e.message);
    }
  }

  static validateFromYaml(protocolYaml) {
    try {
      const protocol = yaml.safeLoad(protocolYaml);
      const result = Joi.validate(protocol, jobProtocolSchema);
      return String(result.error || '');
    } catch (err) {
      return String(err.message);
    }
  }

  getUpdatedProtocol(jobBasicInfo, jobTaskRoles, jobParameters, jobSecrets) {
    const parameters = removeEmptyProperties(
      jobParameters
        .map((parameter) => {
          const param = {};
          param[parameter.key] = parameter.value;
          return param;
        })
        .reduce(keyValueArrayReducer, {}),
    );
    let deployments = this._generateDeployments(jobTaskRoles);
    const delpoyName = get(this, 'defaults.deployment', 'defaultDeployment');
    deployments = isEmpty(deployments) ? [] : [{name: delpoyName, taskRoles: deployments}];

    const prerequisites = this._getTaskRolesPrerequisites(jobTaskRoles);
    const taskRoles = this._updateAndConvertTaskRoles(jobTaskRoles);
    const secrets = removeEmptyProperties(jobSecrets.map((secret) => {
      const s = {};
      s[secret.key] = secret.value;
      return s;
    }).reduce(keyValueArrayReducer, {}));
    const defaultsField = removeEmptyProperties(jobBasicInfo.getDefaults());

    return new JobProtocol({
      ...this,
      ...jobBasicInfo.convertToProtocolFormat(),
      parameters: parameters,
      taskRoles: taskRoles,
      prerequisites: prerequisites,
      deployments: deployments,
      secrets: secrets,
      defaults: defaultsField,
    });
  }

  _getTaskRolesPrerequisites(jobTaskRoles) {
    const map = new Map();
    const prerequisites = jobTaskRoles.map((taskRole) => taskRole.getDockerPrerequisite());
    prerequisites.forEach((value) => map.set(value.name, value));
    return Array.from(map.values());
  }

  _updateAndConvertTaskRoles(jobTaskRoles) {
    const taskRoles = jobTaskRoles.map((taskRole) => {
      return taskRole.convertToProtocolFormat();
    }).reduce(keyValueArrayReducer, {});

    return taskRoles;
  }

  _generateDeployments(jobTaskRoles) {
    const deployments = jobTaskRoles.map((taskRole) => {
      const deployment = {};
      deployment[taskRole.name] = taskRole.getDeployment();
      return deployment;
    }).reduce(keyValueArrayReducer, {});
    return removeEmptyProperties(deployments);
  }

  toYaml() {
    try {
      return yaml.safeDump(removeEmptyProperties(this));
    } catch (e) {
      alert(e.message);
    }
  }
}