interface Generic { [key: string]: any; }

// Trello Types
export interface Orderable extends Generic { pos: number; }
export interface Typed extends Generic { type: string; }
export interface Entity extends Generic { id: string; }

export function sorted(arr: Orderable[]) {
  return arr.slice().sort((a: Orderable, b: Orderable) => a.pos - b.pos);
}

// Github Types
export interface GithubEntity extends Generic { id: number; number?: number; }

export function isGithubEntity(a: GithubEntity | any): a is GithubEntity {
  return "number" === typeof (a as GithubEntity).id && (!("number" in  a) || "number" === typeof a.number);
}
