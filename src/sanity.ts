export default function sanity(tree: any) {
  const board = tree.id;
  const members: MemberObj[] = tree.members.map((m: MemberObj) => ({ id: m.id, username: m.username }));
  const activeUsers = members.filter((m) => contains([
    "ankitsri",
    "arvind_sv",
    "loudapena",
    "marquesfarques",
    "naveenbhaskar6",
    "steven_st",
    "ibnc2",
    "kiera_radman"
  ], m.username)).map((m) => m.id);

  function getUsername(id: string): string {
    return members.find((m) => m.id === id)!.username;
  }

  function contains(arr: any[], el: any): boolean {
    return -1 !== arr.indexOf(el);
  }

  function dfs(tree: any, path: string, lambda: LambdaInspect) { // depth-first-search
    if (!tree) { return; }

    if ("object" === typeof tree) {
      if (tree instanceof Array) {
        for (let i = tree.length - 1; i >= 0; i--) { dfs(tree[i], `${path}[${i}]`, lambda); }
      } else {
        for (const key of Object.keys(tree)) {
          lambda(tree, key, logger(path));
          dfs(tree[key], `${path}.${key}`, lambda);
        }
      }
    }
  }

  dfs(tree, "board", (obj, k, log) => {
    // sanity check to make sure there are no foreign objects in this tree
    if (k === "idBoard" && obj[k] !== board) {
      log(`does not belong to this board`, obj[k]);
    }

    // see if any inactive users created any data
    // membership[] fields are ok
    if (k === "idMember" && !contains(activeUsers, obj[k])) {
      log(`refers to a user that is not considered active on this board`, getUsername(obj[k]));
    }

    // if (k === "attachments" && obj[k].length) {
    //   console.log("attachments from card", obj);
    //   for (const att of obj[k]) {
    //     console.log(att);
    //   }
    // }
  });

  function logger(path: string) {
    return (...args: any[]) => console.log(`el at path ${path}`, ...args);
  }
}

interface MemberObj {
  id: string;
  username: string;
}

type LambdaInspect = (o: any, k: string, l: LogFn) => void;
type LogFn = (...args: any[]) => void;
