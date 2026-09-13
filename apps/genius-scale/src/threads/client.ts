import type {ThreadsCreateRequest} from './payload.js';

export type ThreadsFetch = typeof fetch;

export interface ThreadsClientOptions {
  accessToken: string;
  baseUrl?: string;
  fetchImpl?: ThreadsFetch;
}

export class ThreadsApiError extends Error {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(message: string, status: number, responseBody: unknown) {
    super(message);
    this.name = 'ThreadsApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

const appendFormValue = (form: URLSearchParams, key: string, value: unknown): void => {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    form.set(key, value.join(','));
    return;
  }

  form.set(key, String(value));
};

const toForm = (values: Record<string, unknown>): URLSearchParams => {
  const form = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    appendFormValue(form, key, value);
  }

  return form;
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {raw: text};
  }
};

export class ThreadsClient {
  private readonly fetchImpl: ThreadsFetch;
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(options: ThreadsClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://graph.threads.net/v1.0';
    this.accessToken = options.accessToken;
  }

  async createContainer(userId: string, request: ThreadsCreateRequest): Promise<unknown> {
    return this.post(`${this.baseUrl}/${userId}/threads`, {
      ...request,
      access_token: this.accessToken,
    });
  }

  async publishContainer(userId: string, creationId: string): Promise<unknown> {
    return this.post(`${this.baseUrl}/${userId}/threads_publish`, {
      creation_id: creationId,
      access_token: this.accessToken,
    });
  }

  async checkUser(userId: string): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/${userId}`);
    url.searchParams.set('access_token', this.accessToken);

    const response = await this.fetchImpl(url.toString());
    const body = await parseResponseBody(response);

    if (!response.ok) {
      throw new ThreadsApiError(`Threads API request failed with ${response.status}`, response.status, body);
    }

    return body;
  }

  private async post(url: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: toForm(body),
    });
    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      throw new ThreadsApiError(`Threads API request failed with ${response.status}`, response.status, responseBody);
    }

    return responseBody;
  }
}

export const createThreadsClient = (options: ThreadsClientOptions): ThreadsClient => new ThreadsClient(options);
