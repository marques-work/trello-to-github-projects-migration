import minimist from "minimist";
import github from "../github";
import Progress from "../progress";
import {die, loadConfig} from "../utils";

const opts = minimist(process.argv.slice(2), { alias: { c: "config" } });
const config = loadConfig(opts.config);
const progress = new Progress(config.progress, false);

if (!opts._.length) {
  die("You must specify what you want to destroy");
}

const kind = opts._[0];

switch (kind) {
  case "issues":
    github.issues.closeAll(config.owner, config.repo);
    break;
  case "cards":
    const cardIds = progress.cards().map(
        (id) => progress.githubId("project-cards", id)
      ).filter((num) => void 0 !== num) as number[];

    if (!cardIds.length) { die("No project cards to delete"); }
    github.cards.destroyAll(cardIds);
    break;
  case "lists":
    github.columns.destroyAll(config.projId);
    break;
  default:
    die(`Don't know how to handle ${kind}`);
    break;
}
