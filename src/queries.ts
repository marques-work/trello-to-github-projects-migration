import {githubMemberByTrelloName} from "./preloaded_data";
import {sorted} from "./types";

const cardUrlPrefix = "https://trello.com/c/", prefixLen = cardUrlPrefix.length;

function detectCardAttachment(a: any): boolean {
  return !a.isUpload && a.url.startsWith(cardUrlPrefix);
}

function shortLinkFromUrl(url: string): string {
  return url.startsWith(cardUrlPrefix) ? url.slice(prefixLen, prefixLen + 8) : url;
}

export class CardQuery {
  byId = new Map<string, any>();
  byShortLink = new Map<string, any>();
  hasAttachments = new Set<any>();
  hasCardAttachments = new Set<any>();
  attachedToOtherCard = new Set<any>();

  constructor(cards: any[]) {
    for (const c of cards) {
      this.byId.set(c.id, c);
      this.byShortLink.set(c.shortLink, c);
      if (c.attachments.length) { this.hasAttachments.add(c); }
      if (c.attachments.find(detectCardAttachment)) { this.hasCardAttachments.add(c); }
    }

    for (const c of this.hasCardAttachments) {
      for (const a of c.attachments.filter(detectCardAttachment)) {
        const dep = this.byShortLink.get(shortLinkFromUrl(a.url));
        if (dep) { this.attachedToOtherCard.add(dep); }
      }
    }
  }

  asIssueSpec(id: string, members: MemberQuery, checklists: ChecklistQuery): IssueSpec {
    const card = this.byId.get(id)!;
    return {
      title: card.name,
      body: applyChecklists(card.desc || "", card.idChecklists, checklists),
      labels: card.labels.map((l: any) => l.name),
      assignees: compact(card.idMembers.map((mId: string) => members.githubLoginFor(mId)))
    };
  }
}

interface IssueSpec {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
}

function applyChecklists(desc: string, ids: string[], query: ChecklistQuery): string {
  if (!ids.length) { return desc; }

  // sort by position in-place
  ids.sort((a: string, b: string) => query.byId.get(a).pos - query.byId.get(b).pos);
  return (desc.trim().length ? desc + "\n\n" : desc.trim()) +
    ids.map((id: string) => query.asMarkdown(id)).join("\n");
}

function compact(arr: any[]): any[] {
  return arr.reduce((m, el) => {
    if (el) {
      m.push(el);
    }
    return m;
  }, []);
}

export class ChecklistQuery {
  byId = new Map<string, any>();

  constructor(checklists: any[]) {
    for (const c of checklists) {
      this.byId.set(c.id, c);
    }
  }

  asMarkdown(id: string) {
    if (this.byId.has(id)) {
      const c: any = this.byId.get(id);
      return `## ${c.name}\n\n${sorted(c.checkItems).map(
        (i: any) => `- [${"complete" === i.state ? "x" : " "}] ${i.name}`
      ).join("\n")}`;
    }
  }
}

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
