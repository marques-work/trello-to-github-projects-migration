import fs from "fs";
import minimist from "minimist";
import {CardQuery, ChecklistQuery, DescriptionRenderer, MemberQuery, UploadsQuery} from "../queries";
import {filenameFromArgs, loadConfig, loadDataFromFile} from "../utils";

const opts = minimist(process.argv.slice(2), { alias: { c: "config" } });
const config = loadConfig(opts.config);
const tree = loadDataFromFile(filenameFromArgs(...opts._));

const cardsQ = new CardQuery(tree.cards);
const membersQ = new MemberQuery(tree.members);
const descRenderer = new DescriptionRenderer(
  config,
  membersQ,
  new ChecklistQuery(tree.checklists),
  new UploadsQuery(tree.cards)
).renderer();

const content = tree.cards.reduce((content: string, card: any) => {
  const i = cardsQ.asIssueSpec(card.id, descRenderer, membersQ);
  return content + `# ${i.title}\n\n${i.body}\n<hr/>\n\n`;
}, "");

fs.writeFileSync("preview.md", content, {encoding: "utf8"});
