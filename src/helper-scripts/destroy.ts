import minimist from "minimist";
import github from "../github";
import Progress from "../progress";
import {sequence, wrap} from "../promises";
import {die, loadConfig, loadDataFromFile} from "../utils";

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
  case "show-cards-in-all-columns": // ok, so this isn't really a destroy, but it was convenient to put here
    const tree = loadDataFromFile("trello.json");
    sequence(...tree.lists.map(
        (l: any) => wrap(() => {
          const columnId = progress.githubIdOrDie("lists", l.id);
          return github.cards.list(columnId).then(({body}) => console.log(body.length));
        }, `Cards in list: ${l.name}`, "\n")
      )
    )();
    break;
  default:
    die(`Don't know how to handle ${kind}`);
    break;
}
