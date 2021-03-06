// Licensed to Cloudera, Inc. under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  Cloudera, Inc. licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import $ from 'jquery';

import ApiHelper from 'api/apiHelper';
import sessionManager from './sessionManager';
import * as ApiUtils from 'api/apiUtils';

describe('sessionManager.js', () => {
  let spy;
  beforeEach(() => {
    // sessionManager is a singleton so we need to clear out sessions between tests
    sessionManager.knownSessionPromises = {};
    const sessionCount = {};
    const getSessionCount = type => {
      if (!sessionCount[type]) {
        sessionCount[type] = 0;
      }
      return sessionCount[type]++;
    };
    spy = jest.spyOn(ApiHelper, 'createSession').mockImplementation(async sessionDef =>
      Promise.resolve({
        session_id: sessionDef.type + '_' + getSessionCount(sessionDef.type),
        type: sessionDef.type
      })
    );
  });

  afterEach(() => {
    sessionManager.knownSessionPromises = {};
    spy.mockClear();
  });

  it('should create detached sessions', async () => {
    const sessionDetails = {
      type: 'impala',
      properties: [{ key: 'someKey', value: 'someValue' }]
    };

    expect((await sessionManager.getAllSessions()).length).toEqual(0);

    const session = await sessionManager.createDetachedSession(sessionDetails);

    expect(session.session_id).toEqual('impala_0');

    expect((await sessionManager.getAllSessions()).length).toEqual(0);
    expect(sessionManager.hasSession('impala')).toBeFalsy();
    expect(ApiHelper.createSession).toHaveBeenCalledWith(sessionDetails);
  });

  it('should keep one sessions instance per type', async () => {
    expect((await sessionManager.getAllSessions()).length).toEqual(0);

    let session = await sessionManager.getSession({ type: 'impala' });

    expect(session.session_id).toEqual('impala_0');

    session = await sessionManager.getSession({ type: 'impala' });

    expect(session.session_id).toEqual('impala_0');

    expect((await sessionManager.getAllSessions()).length).toEqual(1);
    expect(sessionManager.hasSession('impala')).toBeTruthy();
    expect(ApiHelper.createSession).toHaveBeenCalledTimes(1);
  });

  it('should keep track of multiple instance per type', async () => {
    expect((await sessionManager.getAllSessions()).length).toEqual(0);

    let session = await sessionManager.getSession({ type: 'impala' });

    expect(session.session_id).toEqual('impala_0');

    session = await sessionManager.getSession({ type: 'hive' });

    expect(session.session_id).toEqual('hive_0');

    expect((await sessionManager.getAllSessions()).length).toEqual(2);
    expect(sessionManager.hasSession('impala')).toBeTruthy();
    expect(sessionManager.hasSession('hive')).toBeTruthy();
    expect(ApiHelper.createSession).toHaveBeenCalledTimes(2);
  });

  it('should stop tracking sessions when closed', async () => {
    expect((await sessionManager.getAllSessions()).length).toEqual(0);

    // Create a session
    const session = await sessionManager.getSession({ type: 'impala' });

    expect(session.session_id).toEqual('impala_0');
    expect(sessionManager.hasSession('impala')).toBeTruthy();

    // Close the session
    const postSpy = jest.spyOn(ApiUtils, 'simplePost').mockImplementation((url, data, options) => {
      expect(JSON.parse(data.session).session_id).toEqual(session.session_id);
      expect(options.silenceErrors).toBeTruthy();
      expect(url).toEqual('/notebook/api/close_session');
      return new $.Deferred().resolve().promise();
    });
    await sessionManager.closeSession(session);

    expect(sessionManager.hasSession('impala')).toBeFalsy();
    expect(ApiHelper.createSession).toHaveBeenCalledTimes(1);
    expect(ApiUtils.simplePost).toHaveBeenCalledTimes(1);
    postSpy.mockClear();
  });

  it('should be able to restart sessions', async () => {
    expect((await sessionManager.getAllSessions()).length).toEqual(0);

    // Create a session
    let session = await sessionManager.getSession({ type: 'impala' });

    expect(session.session_id).toEqual('impala_0');
    expect(sessionManager.hasSession('impala')).toBeTruthy();

    // Restart the session
    const postSpy = jest
      .spyOn(ApiUtils, 'simplePost')
      .mockReturnValue(new $.Deferred().resolve().promise());
    session = await sessionManager.restartSession(session);

    expect(session.session_id).toEqual('impala_1');
    expect(sessionManager.hasSession('impala')).toBeTruthy();

    expect(ApiHelper.createSession).toHaveBeenCalledTimes(2);
    expect(ApiUtils.simplePost).toHaveBeenCalledTimes(1);
    postSpy.mockClear();
  });
});
