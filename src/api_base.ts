import {GotInstance, GotJSONFn, GotPromise} from "got";
import {IncomingHttpHeaders} from "http";
import readline from "readline";
import {URLSearchParams} from "url";
import {die} from "./utils";

function request(promise: GotPromise<any>): Promise<ApiResponse> {
  return (async () => {
    try {
      const response = await promise;
      return {status: response.statusCode!, body: response.body, headers: response.headers};
    } catch (error) {
      console.error(error);
      throw error;
    }
  })();
}

export class Api {
  client: GotInstance<GotJSONFn>;

  constructor(client: GotInstance<GotJSONFn>) {
    this.client = client;
  }

  get(uri: string) {
    return request(this.client.get(uri));
  }

  post(uri: string, body: any = {}) {
    return request(this.client.post(uri, {body}));
  }

  delete(uri: string) {
    return request(this.client.delete(uri));
  }
}

export abstract class Model {
  abstract api: Api;

  guard(question: string, answer: string, callback: () => void) {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });

    prompt.question(`${question} (confirm by typing: ${answer}): `, (reply) => {
      if (answer === reply.trim()) { callback(); } else { console.error("Canceling!"); }
      prompt.close();
    });
  }
}

export function body(promise: Promise<ApiResponse>) {
  promise.then(({body}) => console.log(body)).catch((e) => die("Request failed!", e));
}

export function dump(promise: Promise<ApiResponse>) {
  promise.then(({body, status, headers}) => {
    console.log("status:", status);
    console.log("headers:", headers);
    console.log("body:", body);
  }).catch((e) => die("Request failed!", e));
}

export interface ApiResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: any;
}

export function q(query: Query): string {
  return new URLSearchParams(query).toString();
}

export interface Query {
  [key: string]: string | string[] | undefined;
}
