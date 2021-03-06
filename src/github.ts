import got, {GotInstance, GotJSONFn} from "got";
import {Api, Model, q, Query} from "./api_base";
import {env} from "./utils";

function authToken(): string {
  return `token ${env("GH_TOKEN")}`;
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

interface IssueUpdateSpec {
  body?: string;
  state?: "open" | "closed";
}

interface LabelSpec {
  name: string;
  color: string;
  description?: string;
}

export interface IssueSpec {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

export interface CommentSpec {
  body: string;
}

export interface CardSpec {
  content_id: number;
  content_type: "Issue";
}

export interface CardUpdateSpec {
  archived: boolean;
}

export interface CardMoveSpec {
  column_id?: number;
  position: string;
}

class Cards extends Model {
  api = new Api(inertia);

  list(columnId: number) {
    return this.api.get(`/projects/columns/${columnId}/cards?archived_state=all`);
  }

  create(columnId: number, payload: CardSpec) {
    return this.api.post(`/projects/columns/${columnId}/cards`, payload);
  }

  update(ghId: number, payload: CardUpdateSpec) {
    return this.api.patch(`/projects/columns/cards/${ghId}`, payload);
  }

  move(ghId: number, payload: CardMoveSpec) {
    return this.api.post(`/projects/columns/cards/${ghId}/moves`, payload);
  }

  delete(ghId: number) {
    console.warn("Deleting project card with id:", ghId);
    return this.api.delete(`/projects/columns/cards/${ghId}`);
  }

  destroyAll(ids: number[]) { // too complex to query github for this (must iterate over each column), so use with Progress
    this.guard(`Are you sure you want to delete these ${ids.length} project cards?`, "yep, do it!", () => {
      (async () => {
        for (const id of ids) { await this.delete(id); }
      })();
    });
  }
}

class Issues extends Model {
  api = new Api(symmetra);

  list(owner: string, repo: string, filters?: Query) {
    return this.api.get(`/repos/${owner}/${repo}/issues${filters ? "?" + q(filters) : ""}`);
  }

  create(owner: string, repo: string, cardSpec: IssueSpec) {
    return this.api.post(`/repos/${owner}/${repo}/issues`, cardSpec);
  }

  update(owner: string, repo: string, issueNumber: number, payload: IssueUpdateSpec) {
    return this.api.patch(`/repos/${owner}/${repo}/issues/${issueNumber}`, payload);
  }

  closeAll(owner: string, repo: string) {
    this.guard(`Are you sure you want to close all issues on ${owner}/${repo}?`, "I certainly am", () => {
      let page = 0, issues: any[] = [];
      (async () => {
        do {
          await ((page: number) => {
            return this.list(owner, repo, {state: "open", page: String(page)}).then(({body}) => {
              (async () => {
                issues = body;
                for (const issue of issues) {
                  await this.update(owner, repo, issue.number, {state: "closed"});
                }
              })();
            }).catch((e) => { throw e; });
          })(++page);
        } while (issues.length);
      })();
    });
  }
}

class Comments extends Model {
  api = new Api(gh);

  create(owner: string, repo: string, issueNum: number, payload: CommentSpec) {
    return this.api.post(`/repos/${owner}/${repo}/issues/${issueNum}/comments`, payload);
  }
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
    console.warn("Deleting project column with id:", ghId);
    return this.api.delete(`/projects/columns/${ghId}`);
  }

  destroyAll(projId: number) {
    this.guard("Are you sure you want to delete all columns?", "yes I am", () => {
      this.list(projId).then(({body}) => {
        (async () => {
          for (const list of body) {
            await this.delete(list.id);
          }
        })();
      }).catch((e) => { throw e; });
    });
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

  delete(owner: string, repo: string, name: string) {
    console.warn("Deleting label named:", JSON.stringify(name));
    return this.api.delete(`/repos/${owner}/${repo}/labels/${name}`);
  }

  destroyAll(owner: string, repo: string) {
    this.guard("Are you sure you want to delete all labels?", "yes I am", () => {
      this.list(owner, repo).then(({body}) => {
        (async () => {
          for (const label of body) {
            await this.delete(owner, repo, label.name);
          }
        })();
      }).catch((e) => { throw e; });
    });
  }
}

export default {
  columns: new Columns(),
  cards: new Cards(),
  issues: new Issues(),
  comments: new Comments(),
  labels: new Labels()
};
