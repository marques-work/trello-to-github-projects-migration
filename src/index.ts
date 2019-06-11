import minimist from "minimist";
import github from "./github";
import {mapLabelColor} from "./preloaded_data";
import Progress from "./progress";
import {CardQuery, ChecklistQuery, DescriptionRenderer, MemberQuery, UploadsQuery} from "./queries";
import sanity from "./sanity";
import {sorted, Typed} from "./types";
import {filenameFromArgs, loadConfig, loadDataFromFile} from "./utils";

const opts = minimist(process.argv.slice(2), { alias: { c: "config" } });

const config = loadConfig(opts.config);
const tree = loadDataFromFile(filenameFromArgs(...opts._));

sanity(tree);

const cardsQ = new CardQuery(tree.cards);
const uploadsQ = new UploadsQuery(tree.cards);
const membersQ = new MemberQuery(tree.members);
const checklistsQ = new ChecklistQuery(tree.checklists);

const descRenderer = new DescriptionRenderer(config, membersQ, checklistsQ, uploadsQ).renderer();

const lists = sorted(tree.lists);
const progress = new Progress(config.progress, false);

console.log("Statistics:\n", {
  lists: lists.length,
  labels: tree.labels.length,
  cards: tree.cards.length,
  cardsWithAttachments: cardsQ.hasAttachments.size,
  attachments: tree.cards.reduce((sum: number, c: any) => (sum + c.attachments.length), 0),
  attachmentsThatAreUploads: tree.cards.reduce((sum: number, c: any) => (sum + (c.attachments.reduce((res: number, a: any) => (res + (a.isUpload << 0)), 0))), 0),
  attachmentsThatAreCards: tree.cards.reduce((sum: number, c: any) => (sum + (c.attachments.reduce((res: number, a: any) => (res + ((!a.isUpload && a.url.startsWith("https://trello.com/c/")) << 0)), 0))), 0),
  attachmentsThatAreOther: tree.cards.reduce((sum: number, c: any) => (sum + (c.attachments.reduce((res: number, a: any) => (res + ((!a.isUpload && !a.url.startsWith("https://trello.com/c/")) as any << 0)), 0))), 0),
  checklists: tree.checklists.length,
  members: tree.members.length,
  comments: tree.actions.filter((a: Typed) => a.type === "commentCard").length
});

// NOTE: for test runs on another repo, you MUST add add the github users to the repo. Validation failures otherwise.

// preload data
//   - member data and manually create mapping
//   - manually create mappings for label colors
// create lists
// create labels
// create issues (2 passes)
//   PASS 1:
//   - construct description:
//     - prepend header indicating source trello card
//       - must escape the trello URL to preserve it after remapping trello->github URLs in PASS 2
//     - build checklists and append to description
//     - build attachments and append to description
//       - list as image links or plain links, depending on type
//       - commit these to the repo and then revert. this way the attachments will live in git history
//         for as long as the repo lives. total hack, but it works.
//     - description may have links to trello (mark for PASS 2)
//     - remap description @mentions (final step, in case checklists introduce mentions too)
//   - assignees
//
//   PASS 2:
//     - remap trello card links to github issues (covers, body, checklists, attachments)
//   - apply comments (with @mentions)
//     - IT TURNS OUT WE NEED TO FETCH SEPARATELY -- the export doesn't contain all comments
//     - remap trello links to issues in comment content
//     - it's worth noting that the comment author will ALWAYS be the API user
//       - we should prepend comments with the real author's username
// create cards for each issue
// move cards to column
// mark cards as archived
// mark issues as closed (could this be part of PASS 2?)
sequence(
  announce("Lists", migrateAllLists(config.projId, lists)),
  announce("Labels", migrateAllLabels(config.owner, config.repo, tree.labels)),
  announce("Cards->Issues", migrateAllCardsToIssues(config.owner, config.repo, tree.cards))
);

function sequence(...promises: Array<Promise<any>>): Promise<any> {
  return (async () => {
    for (const p of promises) { await p; } // promises, promises...
  })().finally(() => progress.flush());
}

function announce(name: string, promise: Promise<any>) {
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

function migrateAllCardsToIssues(owner: string, repo: string, cards: any[]) {
  return (async () => {
    for (const card of cards) {
      await migrateCardToIssue(owner, repo, card);
    }
  })();
}

function migrateCardToIssue(owner: string, repo: string, card: any) {
  const payload = cardsQ.asIssueSpec(card.id, descRenderer, membersQ);
  return progress.track("cards", card.id, () => github.issues.create(owner, repo, payload), ["number"]);
}

function migrateLabel(owner: string, repo: string, label: any) {
  return progress.track("labels", label.id, () => github.labels.create(owner, repo, {
    name: label.name,
    color: mapLabelColor(label.color),
    description: label.name
  }));
}

function migrateAllLabels(owner: string, repo: string, labels: any[]) {
  return (async () => {
    for (const label of labels) {
      await migrateLabel(owner, repo, label);
    }
  })();
}

function migrateList(project: number, list: any) {
  return progress.track("lists", list.id, () => github.columns.create(project, list.name));
}

function migrateAllLists(project: number, lists: any[]) {
  return (async () => {
    for (const list of lists) {
      await migrateList(project, list);
    }
  })();
}

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
