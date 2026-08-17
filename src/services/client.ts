import type { Event, PintoErrorPayload, Request, Response, ResponseMap } from './messages';

/**
 * Typed front door to the service worker. The panel never touches
 * `chrome.runtime` directly, so every call is checked against the same union
 * the worker switches on and a new message can't be half-implemented.
 */
export class RequestFailed extends Error {
  constructor(readonly payload: PintoErrorPayload) {
    super(payload.message);
    this.name = 'RequestFailed';
  }
}

export async function send<T extends Request['type']>(
  request: Extract<Request, { type: T }>,
): Promise<ResponseMap[T]> {
  let response: Response<ResponseMap[T]> | undefined;
  try {
    response = (await chrome.runtime.sendMessage(request)) as Response<ResponseMap[T]>;
  } catch (error) {
    throw new RequestFailed({
      code: 'runtime/disconnected',
      message: 'Pinto lost its connection to the extension.',
      hint: 'Reload the Play Console tab and try again.',
      detail: error instanceof Error ? error.message : String(error),
      retryable: true,
    });
  }

  if (!response) {
    throw new RequestFailed({
      code: 'runtime/no-response',
      message: 'Pinto did not get a response from the extension.',
      hint: 'Reload the Play Console tab and try again.',
      retryable: true,
    });
  }
  if (!response.ok) throw new RequestFailed(response.error);
  return response.data;
}

export function onEvent(handler: (event: Event) => void): () => void {
  const listener = (message: unknown) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    const type = (message as { type: string }).type;
    if (type === 'apply/progress' || type === 'auth/changed' || type === 'context/changed') {
      handler(message as Event);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

export function asPayload(error: unknown): PintoErrorPayload {
  if (error instanceof RequestFailed) return error.payload;
  return {
    code: 'ui/unexpected',
    message: 'Something went wrong.',
    detail: error instanceof Error ? error.message : String(error),
    retryable: true,
  };
}
