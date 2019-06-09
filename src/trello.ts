import got from "got";
import {Api, Model, q, Query} from "./api_base";
import {env} from "./utils";

const gh = got.extend({
  baseUrl: "https://api.trello.com/1",
  json: true
});

class Comments extends Model {
  api = new Api(gh);

  all(board: string) {
    return this.api.get(trelloAuth(`/boards/${board}/cards/all`, this.params()));
  }

  private params(): Query {
    return { limit: "1000", fields: "id", actions: "commentCard" };
  }
}

function trelloAuth(url: string, query: Query = {}): string {
  query = Object.assign(query, { key: env("TRELLO_APP"), token: env("TRELLO_TOKEN") });
  return [url, q(query)].join("?");
}

export default {
  comments: new Comments()
};
