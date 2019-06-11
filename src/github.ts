import got, {GotInstance, GotJSONFn} from "got";
import {Api, Model} from "./api_base";
import {IssueSpec} from "./queries";
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

class Issues extends Model {
  api = new Api(symmetra);

  create(owner: string, repo: string, cardSpec: IssueSpec) {
    return this.api.post(`/repos/${owner}/${repo}/issues`, cardSpec);
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

interface LabelSpec {
  name: string;
  color: string;
  description?: string;
}

export default {
  columns: new Columns(),
  cards: inertia,
  issues: new Issues(),
  assignees: symmetra,
  comments: gh,
  labels: new Labels()
};
