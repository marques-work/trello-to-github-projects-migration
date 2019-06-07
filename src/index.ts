import github, {body} from "./github";
import Progress from "./progress";
import {CardQuery, MemberQuery} from "./queries";
import sanity from "./sanity";
import {Orderable, Typed} from "./types";
import {die, filenameFromArgs, loadDataFromFile} from "./utils";

const PROGRESS = "progress.json"; // records how far we've gone in case we get interrupted
const PROJ = 2748526; // project number 16

const tree = loadDataFromFile(filenameFromArgs());

sanity(tree);

const cards = new CardQuery(tree.cards);
const members = new MemberQuery(tree.members);

const lists = tree.lists.sort((a: Orderable, b: Orderable) => a.pos < b.pos);
const progress = new Progress(PROGRESS, false);

console.log("Statistics:\n", {
  lists: lists.length,
  labels: tree.labels.length,
  cards: tree.cards.length,
  checklists: tree.checklists.length,
  members: tree.members.length,
  comments: tree.actions.filter((a: Typed) => a.type === "commentCard").length
});

sequence(
  announce(ensureListsToColumns(PROJ, lists), "Lists")
);

// body(github.labels.list("gocd", "gocd"));
// github.columns.destroyAll(PROJ);


function sequence(...promises: Array<Promise<any>>): Promise<any> {
  return (async () => {
    for (const p of promises) { await p; } // promises, promises...
  })().finally(() => progress.flush());
}

function announce(promise: Promise<any>, name: string) {
  return (async () => {
    try {
      console.log(`Migrating ${name}...`);
      await promise;
      console.log(`${name} migrated.`);
    } finally {
      progress.flush();
    }
  })();
}

function ensureListMigration(project: number, list: any) {
  return progress.track("lists", list.id, () => github.columns.create(project, list.name));
}

function ensureListsToColumns(project: number, lists: any[]) {
  return (async () => {
    for (const list of lists) {
      await ensureListMigration(project, list);
    }
  })();
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

// for (const list of tree.lists) {
//   const lPayload = {id: list.id, name: list.name, closed: list.closed};

// }

// console.log(Object.keys(tree));

// labels
// attachments
// checklists
//   -checkItems: [
//   {
//     idChecklist: '5ca6512be49d903a315f7cdf',
//     state: 'complete',
//     id: '5ca6514a3220dd2d0f8c7e25',
//     name: 'Non-annoying way to show success - try on codepen.io',
//     nameData: null,
//     pos: 16722
//   },
//   {
//     idChecklist: '5ca6512be49d903a315f7cdf',
//     state: 'complete',
//     id: '5ca651805ca72d7db6c70ce6',
//     name: 'How to detect first state - maybe just pass a ' +
//       'param to the dashboard redirect and set a flag on ' +
//       'the user in the backend so it ever only shows ' +
//       'once.',
//     nameData: null,
//     pos: 33125
//   }
// ]
// members - map to GH accounts; fetch id and username

/*
id: string
  idLabels: [ '5ca3d99a91d0c2ddc59c5006' ],
  idList: '5ca52ff089ca8d6fe7bafc13',
  desc: string
  idAttachmentCover: ""

idChecklists: [],
    idMembers: [
    '5c921414a7d31618afb43dd0',
    '5c2fa0623d0f14891c472c70',
    '5bff2aae33cbb1135ffd69ec'
  ],
  labels: [
    {
      id: '5ca3d99a91d0c2ddc59c5006',
      idBoard: '5ca3d99a0378a65090e676ca',
      name: 'Pipelines as Code',
      color: 'orange'
    }
  ],
   name: 'PaC: Flow 1 - Find material in repo',

   closed: false  // archived

     attachments: [
    {
      bytes: 217810,
      date: '2019-05-29T19:40:34.833Z',
      edgeColor: '#fbfbfb',
      idMember: '564cd4f72311056e5e0e6628',
      isUpload: true,
      mimeType: null,
      name: 'Screen Shot 2019-05-29 at 12.40.17 PM.png',
      previews: [Array],
      url: 'https://trello-attachments.s3.amazonaws.com/5ca3d99a0378a65090e676ca/5ceedf1bc6515254e2db2b28/cadb93dcaa65c488ddcafe08848a8f72/Screen_Shot_2019-05-29_at_12.40.17_PM.png',
      pos: 16384,
      id: '5ceee03290efbd441b32627e'
    },
    {
      bytes: 197802,
      date: '2019-06-03T22:47:24.514Z',
      edgeColor: '#f9f9f9',
      idMember: '5bff2aae33cbb1135ffd69ec',
      isUpload: true,
      mimeType: null,
      name: 'Screen Shot 2019-06-03 at 4.46.42 PM.png',
      previews: [Array],
      url: 'https://trello-attachments.s3.amazonaws.com/5ca3d99a0378a65090e676ca/5ceedf1bc6515254e2db2b28/1fe02dc766e7cabce95d19860e0c9a29/Screen_Shot_2019-06-03_at_4.46.42_PM.png',
      pos: 32768,
      id: '5cf5a37c9a63d746fb82b4d6'
    }
  ]

  labels: [  // should exist at top level as join table
    {
      id: '5ca3d99a91d0c2ddc59c5006',
      idBoard: '5ca3d99a0378a65090e676ca',
      name: 'Pipelines as Code',
      color: 'orange'
    }
  ]
*/
