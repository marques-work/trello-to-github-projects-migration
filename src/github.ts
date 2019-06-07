import got, {GotInstance, GotJSONFn, GotPromise} from "got";
import readline from "readline";
import {URLSearchParams} from "url";
import {ApiResponse} from "./types";
import {die} from "./utils";

function authToken() {
  if (!process.env.GH_TOKEN) {
    throw new Error("You must set $GH_TOKEN!");
  }
  return `token ${process.env.GH_TOKEN}`;
}

const gh = got.extend({
  baseUrl: "https://api.github.com",
  json: true,
  headers: {
    Authorization: authToken()
  }
});

const inertia: GotInstance<GotJSONFn> = gh.extend({ headers: { Accept: "application/vnd.github.inertia-preview+json" } });
const symmetra: GotInstance<GotJSONFn> = gh.extend({ headers: { Accept: "application/vnd.github.symmetra-preview+json" } });

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

class Api {
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

abstract class Model {
  abstract api: Api;

  guard(question: string, answer: string, callback: () => void) {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });

    prompt.question(`${question} (confirm by typing: ${answer}): `, (reply) => {
      if (answer === reply.trim()) { callback(); } else { console.error("Canceling!"); }
      prompt.close();
    });
  }
}

class Issues extends Model {
  api = new Api(symmetra);
}

class Columns extends Model {
  api = new Api(inertia);

  list(projId: number) {
    return this.api.get(`/projects/${projId}/columns`);
  }

  create(projId: number, name: string) {
    return this.api.post(`/projects/${projId}/columns`, {name});
  }

  delete(ghId: number) {
    return this.api.delete(`/projects/columns/${ghId}`);
  }

  destroyAll(projId: number) {
    this.guard("Are you sure you want to delete all columns?", "yes I am", () => {
      this.list(projId).then(({status, body, headers}) => {
        (async () => {
          for (const list of body) {
            await this.delete(list.id);
          }
        })();
      }).catch((e) => { throw e; });
    });
  }
}

class Collaborators extends Model {
  api = new Api(inertia);

  list(projId: number) {
    return this.api.get(`/projects/${projId}/collaborators`);
  }
}

class Labels extends Model {
  api = new Api(symmetra);

  list(owner: string, repo: string) {
    return this.api.get(`/repos/${owner}/${repo}/labels`);
  }

  create(owner: string, repo: string, body: LabelSpec) {
    return this.api.post(`/repos/${owner}/${repo}/labels`, body);
  }
}

interface LabelSpec {
  name: string;
  color: string;
  description?: string;
}

export default {
  collaborators: new Collaborators(),
  columns: new Columns(),
  cards: inertia,
  issues: symmetra,
  assignees: symmetra,
  comments: gh,
  labels: new Labels()
};

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

interface Query {
  [key: string]: string | string[] | undefined;
}
