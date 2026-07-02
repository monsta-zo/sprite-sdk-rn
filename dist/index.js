"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  SpriteErrorBoundary: () => SpriteErrorBoundary,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"));
var import_react_native = require("react-native");
var ENDPOINT = "https://sprite-app-production-7715.up.railway.app/api";
var _config = null;
var _sessionId = _uuid();
var _userId = null;
var _appStartTime = Date.now();
var _initialized = false;
var _actionTraceId = null;
var _pendingFetches = 0;
function init(config) {
  var _a, _b;
  if (_initialized) return;
  _initialized = true;
  _config = config;
  _userId = (_a = config.userId) != null ? _a : null;
  _hookFetch();
  _hookErrorHandler();
  _hookUnhandledRejection();
  _hookAppState();
  _send({
    session_id: _sessionId,
    platform: "react_native",
    type: "performance",
    name: "app_start",
    payload: {
      start_time: _appStartTime,
      os: import_react_native.Platform.OS,
      os_version: import_react_native.Platform.Version,
      environment: (_b = config.environment) != null ? _b : "production"
    }
  });
}
function setUserId(userId) {
  _userId = userId;
}
function captureError(error, extra = {}) {
  const err = _normalizeError(error);
  _send({
    session_id: _sessionId,
    trace_id: _actionTraceId != null ? _actionTraceId : void 0,
    user_id: _userId,
    platform: "react_native",
    type: "error",
    name: err.name,
    payload: __spreadValues(__spreadValues({
      message: err.message,
      stack: err.stack
    }, extra), _meta())
  });
}
function track(name, properties = {}) {
  if (!_actionTraceId) {
    _actionTraceId = _uuid();
  }
  _send({
    session_id: _sessionId,
    trace_id: _actionTraceId,
    user_id: _userId,
    platform: "react_native",
    type: "track",
    name,
    payload: __spreadValues(__spreadValues({}, properties), _meta())
  });
}
var _lastTrackedScreen;
function trackNavigation(currentPath, previousPath) {
  if (!currentPath || currentPath === _lastTrackedScreen) return;
  _lastTrackedScreen = currentPath;
  _send({
    session_id: _sessionId,
    user_id: _userId,
    platform: "react_native",
    type: "track",
    name: "screen_view",
    payload: __spreadValues({
      screen: currentPath,
      previous_screen: previousPath != null ? previousPath : null
    }, _meta())
  });
}
var Sprite = {
  init,
  setUserId,
  captureError,
  track,
  trackNavigation
};
var index_default = Sprite;
function _send(event) {
  if (!_config) return;
  fetch(ENDPOINT + "/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event)
  }).catch(() => {
  });
}
function _meta() {
  var _a;
  return {
    environment: (_a = _config == null ? void 0 : _config.environment) != null ? _a : "production",
    os: import_react_native.Platform.OS
  };
}
function _uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
function _normalizeError(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "UnknownError", message: String(error) };
}
function _hookErrorHandler() {
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    captureError(error, { is_fatal: isFatal != null ? isFatal : false });
    prev == null ? void 0 : prev(error, isFatal);
  });
}
function _hookFetch() {
  const originalFetch = global.fetch;
  global.fetch = async function hookedFetch(input, init2) {
    var _a, _b, _c;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (_config && url.startsWith(ENDPOINT)) {
      return originalFetch(input, init2);
    }
    if (url.includes("/symbolicate") || url.includes("__metro") || url.includes("hot-update")) {
      return originalFetch(input, init2);
    }
    const existingHeaders = new Headers(init2 == null ? void 0 : init2.headers);
    const traceId = (_b = (_a = existingHeaders.get("x-trace-id")) != null ? _a : _actionTraceId) != null ? _b : _uuid();
    existingHeaders.set("x-trace-id", traceId);
    existingHeaders.set("x-session-id", _sessionId);
    _pendingFetches++;
    const start = Date.now();
    const method = (_c = init2 == null ? void 0 : init2.method) != null ? _c : "GET";
    try {
      const response = await originalFetch(input, __spreadProps(__spreadValues({}, init2), { headers: existingHeaders }));
      const latency_ms = Date.now() - start;
      _send({
        session_id: _sessionId,
        trace_id: traceId,
        user_id: _userId,
        platform: "react_native",
        type: response.ok ? "network" : "error",
        name: `${method} ${_stripQuery(url)}`,
        payload: __spreadValues({
          url,
          method,
          status_code: response.status,
          latency_ms
        }, _meta())
      });
      return response;
    } catch (err) {
      const latency_ms = Date.now() - start;
      const normalized = _normalizeError(err);
      _send({
        session_id: _sessionId,
        trace_id: traceId,
        user_id: _userId,
        platform: "react_native",
        type: "error",
        name: `${method} ${_stripQuery(url)}`,
        payload: __spreadValues({
          url,
          method,
          latency_ms,
          error: normalized.message
        }, _meta())
      });
      throw err;
    } finally {
      if (--_pendingFetches === 0) _actionTraceId = null;
    }
  };
}
function _hookAppState() {
  let prevState = import_react_native.AppState.currentState;
  import_react_native.AppState.addEventListener("change", (nextState) => {
    _send({
      session_id: _sessionId,
      user_id: _userId,
      platform: "react_native",
      type: "track",
      name: "app_state_change",
      payload: __spreadValues({
        from: prevState,
        to: nextState,
        screen: _lastTrackedScreen != null ? _lastTrackedScreen : null
      }, _meta())
    });
    prevState = nextState;
  });
}
function _hookUnhandledRejection() {
  var _a;
  const handler = (event) => {
    captureError(event.reason, { unhandled_promise: true });
  };
  (_a = globalThis.addEventListener) == null ? void 0 : _a.call(globalThis, "unhandledrejection", handler);
}
function _stripQuery(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch (e) {
    return url.split("?")[0];
  }
}
var SpriteErrorBoundary = class extends import_react.default.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    var _a;
    captureError(error, {
      component_stack: (_a = info.componentStack) != null ? _a : void 0,
      react_error_boundary: true
    });
  }
  render() {
    var _a;
    if (this.state.hasError) {
      return (_a = this.props.fallback) != null ? _a : null;
    }
    return this.props.children;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SpriteErrorBoundary
});
