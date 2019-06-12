import minimist from "minimist";
import github from "./github";
import {mapLabelColor} from "./preloaded_data";
import Progress from "./progress";
import {announce, Promiser, sequence} from "./promises";
import {CardQuery, ChecklistQuery, CommentsQuery, Link, MemberQuery, UploadsQuery} from "./queries";
import sanity from "./sanity";
import {Entity, sortByPos} from "./types";
import {filenameFromArgs, loadConfig, loadDataFromFile} from "./utils";

const opts = minimist(process.argv.slice(2), { alias: { c: "config" } });

const config = loadConfig(opts.config);
const tree = loadDataFromFile(filenameFromArgs(...opts._));

sanity(tree);

const progress = new Progress(config.progress, false);

const lists       = sortByPos(tree.lists);
const cardsQ      = new CardQuery(tree.cards);
const checklistsQ = new ChecklistQuery(tree.checklists);
const commentsQ   = new CommentsQuery(loadDataFromFile("comments.json"));
const membersQ    = new MemberQuery(tree.members);
const uploadsQ    = new UploadsQuery(tree.cards);

const linkMapper      = Link.remapToGithub(cardsQ, progress);
const cardRenderer    = cardsQ.renderer(config, membersQ, checklistsQ, uploadsQ);
const commentRenderer = commentsQ.renderer(Link.remapToGithub(cardsQ, progress), cardsQ, membersQ);

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
  comments: commentsQ.length
});

// CAVEATS:
//   - for test runs on another repo, you MUST add add the github users to the
//     repo. Validation failures otherwise.
//   - IT TURNS OUT WE NEED TO FETCH SEPARATELY -- the export doesn't contain all comments
//
// √ preload data
// √   - member data and manually create mapping
// √   - manually create mappings for label colors
// √ create lists
// √ create labels
//   create issues (2 passes)
// √   PASS 1:
// √   - construct description:
// √     - prepend header indicating source trello card
// √       - must escape the trello URL to preserve it after remapping trello->github URLs in PASS 2
// √     - convert trello number tags (e.g., #123) to trello URLs (later will be remapped to github issues)
// √     - build checklists and append to description
// √     - build attachments and append to description
// √       - list as image links or plain links, depending on type
//       - commit these to the repo and then revert. this way the attachments will live in git history
// √         for as long as the repo lives. total hack, but it works.
// √     - remap @mentions (final step, in case checklists introduce mentions too)
// √   - assignees
//
// √   PASS 2:
// √     - remap trello card links to github issues (covers, body, checklists, attachments)
// √     - mark issues as closed (done in same step as above)
// √     - apply comments (with @mentions)
// √       - convert trello number tags (e.g., #123) to trello URLs (later will be remapped to github issues)
// √       - remap trello links to issues in comment content
// √       - prepend header indicating original comment author as github will author the
//           comment from the user owning the API key
// √       - remap @mentions (final step, in case checklists introduce mentions too)
// √ create cards for each issue in the corresponding column
// √ mark cards as archived
const allCards = tree.cards;

save(
  sequence(
    announce("Lists", migrateAllLists(config.projId, lists)),
    announce("Labels", migrateAllLabels(config.owner, config.repo, tree.labels)),
    announce("Cards->Issues", migrateAllCardsToIssues(config.owner, config.repo, allCards)),
    announce("Cards->Links", migrateAllCardLinks(config.owner, config.repo, allCards)),
    announce("Comments", migrateAllComments(config.owner, config.repo, allCards)),
    announce("Cards->Project Cards", migrateAllCardsToGithubCard(allCards)),
    announce("Archived State on Project Cards", maybeArchiveAllGithubCards(allCards)),
  )
)();

function maybeArchiveAllGithubCards(cards: Entity[]) {
  return save(sequence(...cards.map((card) => maybeArchiveGithubCard(card))));
}
function maybeArchiveGithubCard(card: Entity): Promiser {
  return () => progress.track("cards.state", card.id, () => github.cards.update(
    progress.githubIdOrDie("project-cards", card.id), { archived: card.closed })
  );
}

function migrateAllCardsToGithubCard(cards: Entity[]): Promiser {
  return save(sequence(...cards.map((card) => migrateCardToGithubCard(card))));
}

function migrateCardToGithubCard(card: Entity): Promiser {
  return () => progress.track("project-cards", card.id, () => github.cards.create(
      progress.githubIdOrDie("lists", card.idList),
      {content_id: progress.githubIdOrDie("cards", card.id), content_type: "Issue"}
    ));
}

function migrateAllComments(owner: string, repo: string, cards: Entity[]): Promiser {
  return save(sequence(...cards.map((card) => migrateCommentsOnCard(owner, repo, card))));
}

function migrateCommentsOnCard(owner: string, repo: string, card: Entity): Promiser {
  return sequence(
    ...(commentsQ.getCommentsFor(card).map((cm) => () => progress.track(
          "comments",
          cm.id,
          () => github.comments.create(owner, repo, progress.githubIdOrDie("cards.number", card.id), commentsQ.asSpec(cm, commentRenderer))
    )))
  );
}

function migrateAllCardLinks(owner: string, repo: string, cards: Entity[]): Promiser {
  return save(sequence(...cards.map((card) => migrateCardLinksToIssueNumbers(owner, repo, card))));
}

function migrateCardLinksToIssueNumbers(owner: string, repo: string, card: Entity): Promiser {
  return () => progress.track("card-links", card.id, () => github.issues.update(owner, repo, progress.githubIdOrDie("cards.number", card.id), { body: linkMapper(cardRenderer(card)), state: card.closed ? "closed" : "open" }));
}

function migrateAllCardsToIssues(owner: string, repo: string, cards: Entity[]): Promiser {
  return save(sequence(...cards.map((card) => migrateCardToIssue(owner, repo, card))));
}

function migrateCardToIssue(owner: string, repo: string, card: Entity): Promiser {
  const payload = cardsQ.asIssueSpec(card.id, cardRenderer, membersQ);
  return () => progress.track("cards", card.id, () => github.issues.create(owner, repo, payload), ["number"]);
}

function migrateAllLabels(owner: string, repo: string, labels: Entity[]): Promiser {
  return save(sequence(...labels.map((label) => migrateLabel(owner, repo, label))));
}

function migrateLabel(owner: string, repo: string, label: Entity): Promiser {
  return () => progress.track("labels", label.id, () => github.labels.create(owner, repo, {
    name: label.name,
    color: mapLabelColor(label.color),
    description: label.name
  }));
}

function migrateAllLists(project: number, lists: Entity[]) {
  return save(sequence(...lists.map((list) => migrateList(project, list))));
}

function migrateList(project: number, list: Entity) {
  return () => progress.track("lists", list.id, () => github.columns.create(project, list.name));
}

function save(doTask: Promiser): Promiser {
  return () => doTask().finally(progress.flush);
}
