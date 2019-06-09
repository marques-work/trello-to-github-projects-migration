import got from "got";
import {Api, ApiResponse, Model, q, Query} from "./api_base";
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

  // all(board: string) {
  //   return (async () => {
  //     const response: ApiResponse = {status: 0, body: {}, headers: {}};
  //     for (const isClosed of [true, false]) {
  //       const {status, headers, body} = (await this.allOf(board, isClosed));
  //       response.status = status;
  //       response.headers = headers;
  //       for (const el of body) {
  //         response.body[el.id] = el.actions;
  //       }
  //     }
  //     return response;
  //   })();
  // }

  bulk(ids: string[]) {
    return (async () => {
      const response: ApiResponse = {status: 0, body: {}, headers: {}};
      for (const id of ids) {
        const {status, headers, body} = (await this.list(id));
        response.status = status;
        response.headers = headers;
        response.body[id] = body;
      }
      return response;
    })();
  }

  list(id: string) {
    return (async () => {
      const resp = await this.api.get(trelloAuth(`/cards/${id}`, this.params()));
      console.log("fetched comments for " + id);
      resp.body = resp.body.actions;
      return resp;
    })();
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
