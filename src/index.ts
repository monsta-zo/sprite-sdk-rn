import React from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

type EventType = 'error' | 'track' | 'network' | 'log' | 'performance';

interface SpriteEvent {
  session_id: string;
  trace_id?: string;
  user_id?: string | null;
  platform: 'react_native';
  type: EventType;
  name: string;
  payload: Record<string, unknown>;
}

const ENDPOINT = 'https://sprite-app-production-7715.up.railway.app/api';

interface SpriteConfig {
  userId?: string | null;
  environment?: string;
}

// ─── State ───────────────────────────────────────────────────────────────────

let _config: SpriteConfig | null = null;
let _sessionId: string = _uuid();
let _userId: string | null = null;
let _appStartTime: number = Date.now();
let _initialized = false;
let _actionTraceId: string | null = null;
let _pendingFetches = 0;

// ─── Public API ──────────────────────────────────────────────────────────────

function init(config: SpriteConfig): void {
  if (_initialized) return;
  _initialized = true;

  _config = config;
  _userId = config.userId ?? null;

  _hookFetch();
  _hookErrorHandler();
  _hookUnhandledRejection();
  _hookAppState();

  _send({
    session_id: _sessionId,
    platform: 'react_native',
    type: 'performance',
    name: 'app_start',
    payload: {
      start_time: _appStartTime,
      os: Platform.OS,
      os_version: Platform.Version,
      environment: config.environment ?? 'production',
    },
  });
}

function setUserId(userId: string | null): void {
  _userId = userId;
}


function captureError(error: unknown, extra: Record<string, unknown> = {}): void {
  const err = _normalizeError(error);
  _send({
    session_id: _sessionId,
    trace_id: _actionTraceId ?? undefined,
    user_id: _userId,
    platform: 'react_native',
    type: 'error',
    name: err.name,
    payload: {
      message: err.message,
      stack: err.stack,
      ...extra,
      ..._meta(),
    },
  });
}

function track(name: string, properties: Record<string, unknown> = {}): void {
  if (!_actionTraceId) {
    _actionTraceId = _uuid();
  }
  _send({
    session_id: _sessionId,
    trace_id: _actionTraceId,
    user_id: _userId,
    platform: 'react_native',
    type: 'track',
    name,
    payload: {
      ...properties,
      ..._meta(),
    },
  });
}

let _lastTrackedScreen: string | undefined;

// expo-router의 usePathname()과 연결해서 화면 이동 추적
function trackNavigation(currentPath: string | undefined, previousPath: string | undefined): void {
  if (!currentPath || currentPath === _lastTrackedScreen) return;
  _lastTrackedScreen = currentPath;
  _send({
    session_id: _sessionId,
    user_id: _userId,
    platform: 'react_native',
    type: 'track',
    name: 'screen_view',
    payload: {
      screen: currentPath,
      previous_screen: previousPath ?? null,
      ..._meta(),
    },
  });
}

const Sprite = {
  init,
  setUserId,
  captureError,
  track,
  trackNavigation,
};

export default Sprite;

// ─── Internals ───────────────────────────────────────────────────────────────

function _send(event: SpriteEvent): void {
  if (!_config) return;
  fetch(ENDPOINT + '/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(() => {});
}

function _meta(): Record<string, unknown> {
  return {
    environment: _config?.environment ?? 'production',
    os: Platform.OS,
  };
}

function _uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function _normalizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'UnknownError', message: String(error) };
}

function _hookErrorHandler(): void {
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    captureError(error, { is_fatal: isFatal ?? false });
    prev?.(error, isFatal);
  });
}

function _hookFetch(): void {
  const originalFetch = global.fetch;
  global.fetch = async function hookedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    // Sprite 자체 요청 및 Metro 개발 도구 요청은 후킹 안 함
    if (_config && url.startsWith(ENDPOINT)) {
      return originalFetch(input, init);
    }
    if (url.includes('/symbolicate') || url.includes('__metro') || url.includes('hot-update')) {
      return originalFetch(input, init);
    }

    const existingHeaders = new Headers(init?.headers);
    // 헤더에 이미 있으면 유지, 없으면 현재 액션 trace 또는 새 uuid 사용
    const traceId = existingHeaders.get('x-trace-id') ?? _actionTraceId ?? _uuid();

    existingHeaders.set('x-trace-id', traceId);
    existingHeaders.set('x-session-id', _sessionId);

    _pendingFetches++;
    const start = Date.now();
    const method = init?.method ?? 'GET';

    try {
      const response = await originalFetch(input, { ...init, headers: existingHeaders });
      const latency_ms = Date.now() - start;

      _send({
        session_id: _sessionId,
        trace_id: traceId,
        user_id: _userId,
        platform: 'react_native',
        type: response.ok ? 'network' : 'error',
        name: `${method} ${_stripQuery(url)}`,
        payload: {
          url,
          method,
          status_code: response.status,
          latency_ms,
          ..._meta(),
        },
      });

      return response;
    } catch (err) {
      const latency_ms = Date.now() - start;
      const normalized = _normalizeError(err);

      _send({
        session_id: _sessionId,
        trace_id: traceId,
        user_id: _userId,
        platform: 'react_native',
        type: 'error',
        name: `${method} ${_stripQuery(url)}`,
        payload: {
          url,
          method,
          latency_ms,
          error: normalized.message,
          ..._meta(),
        },
      });

      throw err;
    } finally {
      if (--_pendingFetches === 0) _actionTraceId = null;
    }
  } as typeof fetch;
}

function _hookAppState(): void {
  let prevState: AppStateStatus = AppState.currentState;

  AppState.addEventListener('change', (nextState: AppStateStatus) => {
    _send({
      session_id: _sessionId,
      user_id: _userId,
      platform: 'react_native',
      type: 'track',
      name: 'app_state_change',
      payload: {
        from: prevState,
        to: nextState,
        screen: _lastTrackedScreen ?? null,
        ..._meta(),
      },
    });
    prevState = nextState;
  });
}

function _hookUnhandledRejection(): void {
  const handler = (event: PromiseRejectionEvent) => {
    captureError(event.reason, { unhandled_promise: true });
  };
  globalThis.addEventListener?.('unhandledrejection', handler);
}

function _stripQuery(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url.split('?')[0];
  }
}

// ─── ErrorBoundary ───────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class SpriteErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureError(error, {
      component_stack: info.componentStack ?? undefined,
      react_error_boundary: true,
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
