// tslint:disable-next-line no-var-requires
const GH_MEMBERS = require("../data/gocd_collaborators.json");

const TRELLO_USER_MAP = new Map<string, string>([
  ["ankitsri",       "ankitsri11"],
  ["arvind_sv",      "arvindsv"],
  ["chandrakanth42", "chandrakanth17"],
  ["ganeshpl",       "GaneshSPatil"],
  ["loudapena",      "loudaTW"],
  ["marquesfarques", "marques-work"],
  ["naveenbhaskar6", "naveenbhaskar"],
  ["steven_st",      "streisguth"],
  ["ibnc2",          "ibnc"],
  ["kiera_radman",   "kierarad"],
]);

const memo = new Map<string, any>();
for (const m of GH_MEMBERS) {
  memo.set(m.login, m);
}

function githubMemberByLogin(login: string) {
  return memo.get(login);
}

export function githubMemberByTrelloName(username: string): any | undefined {
  if (TRELLO_USER_MAP.has(username)) {
    return githubMemberByLogin(TRELLO_USER_MAP.get(username)!);
  }
}

const COLORS = {
  black:  "708090",
  blue:   "4169E1",
  green:  "32CD32",
  lime:   "00FA9A",
  orange: "FF8C00",
  pink:   "FF69B4",
  purple: "EE82EE",
  red:    "DC143C",
  sky:    "AFEEEE",
  yellow: "FFD700",
};

export function mapLabelColor(color: keyof (typeof COLORS)): string {
  return COLORS[color] || "696969"; // dark grey
}
