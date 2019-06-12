import fs from "fs";
import minimist from "minimist";
import Progress from "../progress";
import {CardQuery, ChecklistQuery, CommentsQuery, Link, MemberQuery, UploadsQuery} from "../queries";
import {filenameFromArgs, loadConfig, loadDataFromFile} from "../utils";

const opts = minimist(process.argv.slice(2), { alias: { c: "config" } });
const config = loadConfig(opts.config);
const tree = loadDataFromFile(filenameFromArgs(...opts._));
const comments = loadDataFromFile("comments.json");
const progress = new Progress(config.progress, false);

const cardsQ = new CardQuery(tree.cards);
const membersQ = new MemberQuery(tree.members);
const descRenderer = cardsQ.renderer(
  config,
  membersQ,
  new ChecklistQuery(tree.checklists),
  new UploadsQuery(tree.cards)
);

const content = tree.cards.reduce((content: string, card: any) => {
  const i = cardsQ.asIssueSpec(card.id, descRenderer, membersQ);
  return content + `# ${i.title}\n\n${i.body}\n<hr/>\n\n`;
}, "");

fs.writeFileSync("preview.md", content, {encoding: "utf8"});

const cq = new CommentsQuery(comments);
const rend = cq.renderer(Link.remapToGithub(cardsQ, progress), cardsQ, membersQ);

fs.writeFileSync("preview-comments.md", comments.reduce(
  (content: string, com: any) => content + `${rend(com)}\n<hr/>\n\n`, ""),
  {encoding: "utf8"}
);
