import {createHash} from "crypto";
import {basename, extname} from "path";
import {githubMemberByTrelloName} from "./preloaded_data";
import Progress from "./progress";
import {Entity, sorted} from "./types";
import {ConfigGH} from "./utils";

export type StringMapper = (input: string) => string;
export type EntityRenderer = (entity: Entity) => string;

function compact(arr: any[]): any[] {
  return arr.reduce((m, el) => {
    if (el) { m.push(el); }
    return m;
  }, []);
}

export interface IssueSpec {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

export interface CommentSpec {
  body: string;
}

export class CardQuery {
  byId = new Map<string, Entity>();
  byShortLink = new Map<string, Entity>();
  hasAttachments = new Set<Entity>();

  constructor(cards: Entity[]) {
    for (const c of cards) {
      this.byId.set(c.id, c);
      this.byShortLink.set(c.shortLink, c);
      if (c.attachments.length) { this.hasAttachments.add(c); }
    }
  }

  asIssueSpec(id: string, descRenderer: (card: any) => string, members: MemberQuery): IssueSpec {
    const card = this.byId.get(id)!;
    return {
      title: card.name,
      body: descRenderer(card),
      labels: card.labels.map((l: any) => l.name),
      assignees: compact(card.idMembers.map((mId: string) => members.githubLoginFor(mId)))
    };
  }
}

export class DescriptionRenderer {
  config: ConfigGH;
  members: MemberQuery;
  checklists: ChecklistQuery;
  uploads: UploadsQuery;

  constructor(config: ConfigGH, members: MemberQuery, checklists: ChecklistQuery, uploads: UploadsQuery) {
    this.config = config;
    this.members = members;
    this.checklists = checklists;
    this.uploads = uploads;
  }

  renderer(): EntityRenderer {
    const urlMapper = (url: string) => this.uploads.remap(url, this.config.owner, this.config.repo, this.config.sha);
    return (card: any) => (compact([this.cardHeader(card), AttachmentsTransform.applyToDesc(
      this.members.replaceMentions(
        this.checklists.applyToDesc(card.desc || "", card.idChecklists)
        ), card.attachments, urlMapper
      ).trim()] as string[]).join("\n\n"));
  }

  private cardHeader(card: any): string {
    return `> Migrated from [Trello Card ${card.idShort}](${this.escapeTrelloUrlFromReplacer(card.shortUrl)})`;
  }

  private escapeTrelloUrlFromReplacer(trelloUrl: string): string {
    // when you want a the original trello URL that won't be converted to a
    // github issue URL during the URL replacement
    return trelloUrl.replace(/\//g, "&#x002f;");
  }
}

const TRELLO_LINK_RE = /\b(https:\/\/trello\.com\/c\/([a-z0-9]{8})(?:\/[\w/?&%.\-=]*)?)/igm;

export class Link {
  static isGithubObject(url: string): boolean {
    return !!url.match(/\bhttps:\/\/github\.com\/[\w]+\/[\w]+\/(?:pull|issues)\/[\d]+/i);
  }

  static isTrelloCard(url: string): boolean {
    // use string.match(), not regex.test() here because of the `g` flag!
    // See: https://stackoverflow.com/a/1520853
    return !!url.match(TRELLO_LINK_RE);
  }

  static remapToGithub(cards: CardQuery, progress: Progress): StringMapper {
    function resolver(shortLink: string) {
      if (cards.byShortLink.has(shortLink)) {
        const trelloId = cards.byShortLink.get(shortLink)!.id;
        const issueNum = progress.githubId("cards.number", trelloId);
        if (void 0 !== issueNum) {
          return `#${issueNum}`;
        }
        console.error(`Link: ${shortLink} (id: ${trelloId}) was not resolved to a Github Issue`);
      }
    }

    return (text: string) =>
      text.replace(TRELLO_LINK_RE, (_: string, trelloUrl: string, shortId: string) => (resolver(shortId) || trelloUrl));
  }
}

class AttachmentsTransform {
  static applyToDesc(cardDesc: string, attachments: any[], urlMapper: (url: string) => string) {
    if (!attachments.length) { return cardDesc; }

    const related = [], uploads = [];

    for (const a of sorted(attachments)) {
      if (a.isUpload) {
        uploads.push(`* ${AttachmentsTransform.isImg(a.name) ? "!" : ""}[${a.name}](${urlMapper(a.url)})`);
      } else {
        if (Link.isGithubObject(a.url) || Link.isTrelloCard(a.url) || a.name === a.url) {
          related.push(`* ${a.url}`);
        } else {
          console.log("dupe name/url?", a.name, a.url);
          related.push(`* [${a.name}](${a.url})`);
        }
      }
    }

    const attachedContent = [
      (related.length ? `## Related\n\n${related.join("\n")}` : ""),
      (uploads.length ? `## Attachments\n\n${uploads.join("\n")}` : "")
    ].join("\n\n").trim();

    return cardDesc.trim().length ?
      cardDesc.trim() + "\n\n" + attachedContent :
      attachedContent;
  }

  static isImg(filename: string): boolean {
    switch (extname(filename).toLowerCase()) {
      case ".png":
      case ".jpg":
      case ".jpeg":
      case ".gif":
        return true;
    }
    return false;
  }
}

function sortByDate(arr: any[]) {
  return arr.slice().sort((a: any, b: any) => (new Date(a.date)).getTime() - (new Date(b.date)).getTime());
}

export class CommentsQuery {
  byCard = new Map<string, any[]>();

  constructor(comments: any[]) {
    for (const c of comments) {
      const all = this.byCard.get(c.data.card.id) || [];
      all.push(c);
      this.byCard.set(c.data.card.id, sortByDate(all));
    }
  }

  static asSpec(comment: any, members: MemberQuery): CommentSpec {
    const body = members.replaceMentions(comment.text);
    return { body };
  }
}

export class ChecklistQuery {
  byId = new Map<string, any>();

  constructor(checklists: any[]) {
    for (const c of checklists) {
      this.byId.set(c.id, c);
    }
  }

  applyToDesc(cardDesc: string, ids: string[]): string {
    if (!ids.length) { return cardDesc; }

    const desc = cardDesc.trim().length ? cardDesc + "\n\n" : cardDesc.trim();
    ids = ids.slice().sort((a: string, b: string) => this.byId.get(a).pos - this.byId.get(b).pos);

    return desc + "## Checklists\n\n" + ids.map((id: string) => this.asMarkdown(id)).join("\n\n");
  }

  asMarkdown(id: string) {
    if (this.byId.has(id)) {
      const c: any = this.byId.get(id);
      return `### ${c.name}\n\n${sorted(c.checkItems).map(
        (i: any) => `- [${"complete" === i.state ? "x" : " "}] ${i.name}`
      ).join("\n")}`;
    }
  }
}

function sha256(subj: string): string {
  return createHash("sha256").update(subj).digest("hex");
}

interface Upload {
  name: string;
  url: string;
  key: string;
}

export class UploadsQuery {
  byUrl = new Map<string, Upload>();
  attachments: Upload[] = [];

  constructor(cards: any[]) {
    for (const card of cards) {
      for (const a of card.attachments.filter((a: any) => a.isUpload)) {
        const upload = {
          name: a.name,
          url: a.url,
          key: [".github", "trello-attachments", sha256(a.url), basename(a.url)].join("/")
        };
        this.attachments.push(upload);
        this.byUrl.set(a.url, upload);
      }
    }
  }

  remap(url: string, owner: string, repo: string, commit: string): string {
    if (!this.byUrl.has(url)) {
      console.error("Could not map attachment url:", url);
      return url;
    }
    return ["https://raw.githubusercontent.com", owner, repo, commit, this.byUrl.get(url)!.key].join("/");
  }
}

const AT_MENTION_RE = /(^|\W)@([\w_-]+)/gim;

export class MemberQuery {
  byId   = new Map<string, any>();
  byUser = new Map<string, any>();

  constructor(members: any[]) {
    for (const m of members) {
      const ghUser = githubMemberByTrelloName(m.username);

      if (ghUser) {
        this.byId.set(m.id, ghUser);
        this.byUser.set(m.username, ghUser);
      }
    }
  }

  replaceMentions(desc: string): string {
    return desc.replace(AT_MENTION_RE, (_: string, $1: string, username: string) => `${$1}@${(this.remapMention(username) || username)}`);
  }

  remapMention(username: string) {
    if (this.byUser.has(username)) {
      return this.byUser.get(username).login;
    }
  }

  githubIdFor(id: string): number | undefined {
    if (this.hasGithubById(id)) {
      return this.byId.get(id).id;
    }
  }

  githubLoginFor(id: string): string | undefined {
    if (this.hasGithubById(id)) {
      return this.byId.get(id).login;
    }
  }

  hasGithubById(id: string): boolean {
    return this.byId.has(id);
  }

  hasGithubByName(username: string): boolean {
    return this.byUser.has(username);
  }
}
