import minimist from "minimist";
import github from "../github";
import {die, loadConfig} from "../utils";

const opts = minimist(process.argv.slice(2), { alias: { c: "config" } });
const config = loadConfig(opts.config);

if (!opts._.length) {
  die("You must specify what you want to destroy");
}

switch (opts._[0]) {
  case "issues":
    github.issues.closeAll(config.owner, config.repo);
    break;
  case "lists":
    github.columns.destroyAll(config.projId);
    break;
  default:
    die(`Don't know how to handle ${opts._[0]}`);
    break;
}
