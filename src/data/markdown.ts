import { marked } from 'marked'
import TurndownService from 'turndown'

// Scripts are stored as markdown. The editor works in HTML, so convert at the edges.
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
})

export const markdownToHtml = (md: string) => marked.parse(md, { async: false, gfm: true, breaks: false })

export const htmlToMarkdown = (html: string) => turndown.turndown(html).trim()
