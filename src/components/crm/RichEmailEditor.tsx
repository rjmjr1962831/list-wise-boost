/**
 * Rich text email editor using TipTap.
 * Outputs HTML. Supports bold, italic, underline, links, lists, headings.
 */
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Heading2,
  Undo,
  Redo,
  Code,
} from "lucide-react";

interface RichEmailEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function RichEmailEditor({ value, onChange }: RichEmailEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { style: "color:#2563eb;text-decoration:underline" },
      }),
      Underline,
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. loading a template)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "<p></p>", false);
    }
  }, [value]);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `p-1.5 rounded transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`;

  const addLink = () => {
    const url = window.prompt("URL:", "https://");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b bg-muted/30">
        <button type="button" className={btnClass(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" className={btnClass(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" className={btnClass(editor.isActive("underline"))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <div className="w-px bg-border mx-1" />
        <button type="button" className={btnClass(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </button>
        <button type="button" className={btnClass(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </button>
        <button type="button" className={btnClass(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </button>
        <div className="w-px bg-border mx-1" />
        <button type="button" className={btnClass(editor.isActive("link"))}
          onClick={addLink}>
          <LinkIcon className="h-4 w-4" />
        </button>
        <div className="w-px bg-border mx-1" />
        <button type="button" className={btnClass(false)}
          onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="h-4 w-4" />
        </button>
        <button type="button" className={btnClass(false)}
          onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="h-4 w-4" />
        </button>
        <div className="w-px bg-border mx-1" />
        <button type="button" className={`${btnClass(false)} text-xs px-2`}
          onClick={() => {
            const html = editor.getHTML();
            navigator.clipboard.writeText(html);
            alert("HTML copied to clipboard");
          }}>
          <Code className="h-4 w-4" />
        </button>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 min-h-[200px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px]"
      />
    </div>
  );
}
