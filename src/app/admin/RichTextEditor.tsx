'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

type RichTextEditorProps = {
	content: string;
	onChange: (html: string) => void;
	placeholder?: string;
};

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				bulletList: {
					HTMLAttributes: {
						class: 'list-disc list-outside ml-4'
					}
				},
				orderedList: {
					HTMLAttributes: {
						class: 'list-decimal list-outside ml-4'
					}
				}
			}),
			Underline,
			Link.configure({
				openOnClick: false,
				HTMLAttributes: {
					class: 'text-blue-600 underline hover:text-blue-800'
				}
			}),
			Placeholder.configure({
				placeholder: placeholder || 'Escribe aquí...'
			})
		],
		content,
		editorProps: {
			attributes: {
				class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] px-3.5 py-2.5'
			}
		},
		onUpdate: ({ editor }) => {
			onChange(editor.getHTML());
		}
	});

	// Actualizar el contenido cuando cambie externamente
	useEffect(() => {
		if (editor && content !== editor.getHTML()) {
			editor.commands.setContent(content);
		}
	}, [content, editor]);

	if (!editor) {
		return null;
	}

	const setLink = () => {
		const url = window.prompt('URL del enlace:');
		if (url) {
			editor.chain().focus().setLink({ href: url }).run();
		}
	};

	return (
		<div className="rounded-lg border border-zinc-300 bg-white focus-within:border-black focus-within:ring-1 focus-within:ring-black">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 p-2">
				{/* Bold */}
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleBold().run()}
					className={`rounded p-2 hover:bg-zinc-100 transition-colors ${
						editor.isActive('bold') ? 'bg-zinc-200 text-black' : 'text-zinc-600'
					}`}
					title="Negrita (Ctrl+B)"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path d="M5 3v14h6.5a4.5 4.5 0 001.7-8.66A4 4 0 0011 3H5zm2 2h4a2 2 0 110 4H7V5zm0 6h5.5a2.5 2.5 0 010 5H7v-5z"/>
					</svg>
				</button>

				{/* Italic */}
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleItalic().run()}
					className={`rounded p-2 hover:bg-zinc-100 transition-colors ${
						editor.isActive('italic') ? 'bg-zinc-200 text-black' : 'text-zinc-600'
					}`}
					title="Cursiva (Ctrl+I)"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path d="M8 3h8v2h-2.5l-3 10H13v2H5v-2h2.5l3-10H8V3z"/>
					</svg>
				</button>

				{/* Underline */}
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleUnderline().run()}
					className={`rounded p-2 hover:bg-zinc-100 transition-colors ${
						editor.isActive('underline') ? 'bg-zinc-200 text-black' : 'text-zinc-600'
					}`}
					title="Subrayado (Ctrl+U)"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path d="M10 15a5 5 0 005-5V3h-2v7a3 3 0 01-6 0V3H5v7a5 5 0 005 5zm-6 2h12v2H4v-2z"/>
					</svg>
				</button>

				{/* Strikethrough */}
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleStrike().run()}
					className={`rounded p-2 hover:bg-zinc-100 transition-colors ${
						editor.isActive('strike') ? 'bg-zinc-200 text-black' : 'text-zinc-600'
					}`}
					title="Tachado"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path d="M3 9h14v2H3V9zm3.5-2.5C6.5 5.12 7.62 4 9 4h2c1.38 0 2.5 1.12 2.5 2.5V7h-2v-.5a.5.5 0 00-.5-.5H9a.5.5 0 00-.5.5v.5h6v2h-3.5v.5a.5.5 0 00.5.5h2a.5.5 0 00.5-.5V13h2v.5c0 1.38-1.12 2.5-2.5 2.5H9c-1.38 0-2.5-1.12-2.5-2.5V13h2v.5a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-.5h-5V9h1.5V6.5z"/>
					</svg>
				</button>

				<div className="w-px h-6 bg-zinc-300 mx-1" />

				{/* Bullet List */}
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					className={`rounded p-2 hover:bg-zinc-100 transition-colors ${
						editor.isActive('bulletList') ? 'bg-zinc-200 text-black' : 'text-zinc-600'
					}`}
					title="Lista con viñetas"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path d="M4 4a1 1 0 11-2 0 1 1 0 012 0zm3-1h10v2H7V3zm-3 7a1 1 0 11-2 0 1 1 0 012 0zm3-1h10v2H7V9zm-3 7a1 1 0 11-2 0 1 1 0 012 0zm3-1h10v2H7v-2z"/>
					</svg>
				</button>

				{/* Ordered List */}
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					className={`rounded p-2 hover:bg-zinc-100 transition-colors ${
						editor.isActive('orderedList') ? 'bg-zinc-200 text-black' : 'text-zinc-600'
					}`}
					title="Lista numerada"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path d="M3 3v2h1v1H3v2h3V6h-1V5h1V3H3zm0 7v1h2v1H3v2h3v-4H3zm0 7v2h3v-2H3zM7 4h10v2H7V4zm0 6h10v2H7v-2zm0 6h10v2H7v-2z"/>
					</svg>
				</button>

				<div className="w-px h-6 bg-zinc-300 mx-1" />

				{/* Code */}
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleCode().run()}
					className={`rounded p-2 hover:bg-zinc-100 transition-colors ${
						editor.isActive('code') ? 'bg-zinc-200 text-black' : 'text-zinc-600'
					}`}
					title="Código inline"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/>
					</svg>
				</button>

				{/* Code Block */}
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleCodeBlock().run()}
					className={`rounded p-2 hover:bg-zinc-100 transition-colors ${
						editor.isActive('codeBlock') ? 'bg-zinc-200 text-black' : 'text-zinc-600'
					}`}
					title="Bloque de código"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path d="M3 3h14a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1zm1 2v10h12V5H4zm2 2h8v2H6V7zm0 3h6v2H6v-2z"/>
					</svg>
				</button>

				{/* Link */}
				<button
					type="button"
					onClick={setLink}
					className={`rounded p-2 hover:bg-zinc-100 transition-colors ${
						editor.isActive('link') ? 'bg-zinc-200 text-black' : 'text-zinc-600'
					}`}
					title="Insertar enlace"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd"/>
					</svg>
				</button>

				{/* Remove Link */}
				{editor.isActive('link') && (
					<button
						type="button"
						onClick={() => editor.chain().focus().unsetLink().run()}
						className="rounded p-2 hover:bg-zinc-100 transition-colors text-zinc-600"
						title="Quitar enlace"
					>
						<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
							<path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
						</svg>
					</button>
				)}
			</div>

			{/* Editor Content */}
			<EditorContent editor={editor} />
		</div>
	);
}

