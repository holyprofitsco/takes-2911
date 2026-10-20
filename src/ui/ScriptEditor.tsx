import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, type CSSProperties } from 'react'
import { htmlToMarkdown, markdownToHtml } from '../data/markdown'

// Formatted editor for one script. Saves markdown a moment after typing stops.
export function ScriptEditor({ videoId, body, onSave }: { videoId: string; body: string; onSave: (md: string) => void }) {
  const timer = useRef<number | undefined>(undefined)
  const save = useRef(onSave)
  save.current = onSave

  const editor = useEditor(
    {
      extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } })],
      content: markdownToHtml(body),
      editorProps: { attributes: { class: 'script-doc', 'aria-label': 'Script' } },
      onUpdate: ({ editor }) => {
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => save.current(htmlToMarkdown(editor.getHTML())), 400)
      },
    },
    [videoId],
  )

  // Flush a pending save when switching scripts or leaving the page.
  useEffect(
    () => () => {
      if (timer.current !== undefined && editor && !editor.isDestroyed) {
        window.clearTimeout(timer.current)
        save.current(htmlToMarkdown(editor.getHTML()))
      }
    },
    [editor],
  )

  if (!editor) return null
  return (
    <>
      <Toolbar editor={editor} />
      <div className="script-scroll">
        <EditorContent editor={editor} />
      </div>
    </>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
    }),
  })

  const buttons: { label: string; text: string; active: boolean; run: () => void; style?: CSSProperties }[] = [
    { label: 'Heading', text: 'H1', active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Subheading', text: 'H2', active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'Bold', text: 'B', active: state.bold, run: () => editor.chain().focus().toggleBold().run(), style: { fontWeight: 700 } },
    { label: 'Italic', text: 'I', active: state.italic, run: () => editor.chain().focus().toggleItalic().run(), style: { fontStyle: 'italic' } },
    { label: 'Bulleted list', text: '•', active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', text: '1.', active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Callout', text: 'Note', active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
  ]

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          aria-label={b.label}
          title={b.label}
          aria-pressed={b.active}
          className={'tool' + (b.active ? ' is-active' : '')}
          style={b.style}
          onMouseDown={(e) => e.preventDefault()}
          onClick={b.run}
        >
          {b.text}
        </button>
      ))}
    </div>
  )
}
