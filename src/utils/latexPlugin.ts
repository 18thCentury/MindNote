import { PluginContext, PluginInfo } from '@toast-ui/editor';
import { Decoration, DecorationSet } from 'prosemirror-view';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// --- Helper Functions ---
const renderLatex = (content: string, isBlock: boolean) => {
    try {
        return katex.renderToString(content, {
            displayMode: isBlock,
            throwOnError: false
        });
    } catch (e) {
        console.error('KaTeX error:', e);
        return `<span style="color: red;">${content}</span>`;
    }
};

const escapeHtml = (text: string) => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// --- Plugin Definition ---
export function latexPlugin(context: PluginContext): PluginInfo {
    const { pmState } = context;
    console.log('LatexPlugin initialized');

    return {
        // 1. Markdown Mode Rendering (ToastMark)
        toHTMLRenderers: {
            text(node: any) {
                const literal = node.literal || '';
                if (!literal.includes('$')) {
                    return null;
                }

                const regex = /(\$\$[\s\S]*?\$\$)|(\$[^\$\n]+\$)/g;
                const tokens: any[] = [];
                let lastIdx = 0;
                let match;

                while ((match = regex.exec(literal)) !== null) {
                    if (match.index > lastIdx) {
                        tokens.push({
                            type: 'text',
                            content: literal.slice(lastIdx, match.index)
                        });
                    }

                    const fullMatch = match[0];
                    const isBlock = fullMatch.startsWith('$$');
                    const content = isBlock ? fullMatch.slice(2, -2) : fullMatch.slice(1, -1);
                    const cleanContent = content.replace(/\\_/g, '_');

                    const renderedHtml = isBlock
                        ? `<div class="katex-block">${renderLatex(cleanContent, true)}</div>`
                        : renderLatex(cleanContent, false);

                    tokens.push({
                        type: 'html',
                        content: renderedHtml
                    });

                    lastIdx = regex.lastIndex;
                }

                if (lastIdx < literal.length) {
                    tokens.push({
                        type: 'text',
                        content: literal.slice(lastIdx)
                    });
                }

                console.log('Markdown Latex Tokens:', tokens.length);
                return tokens;
            }
        },

        // 2. WYSIWYG Mode Rendering (ProseMirror Decorations)
        wysiwygPlugins: [
            () => {
                let editorView: any;
                return new pmState.Plugin({
                    view(view: any) {
                        editorView = view;
                        return {};
                    },
                    props: {
                        decorations(state: any) {
                            const decorations: any[] = [];
                            const { doc, selection } = state;
                            const { from, to } = selection;

                            const regex = /(\$\$[\s\S]+?\$\$)|(\$[^\$\n]+\$)/g;

                            doc.descendants((node: any, pos: number) => {
                                if (node.isText && node.text) {
                                    let match;
                                    while ((match = regex.exec(node.text)) !== null) {
                                        const start = pos + match.index;
                                        const end = start + match[0].length;

                                        // Only render if cursor is not inside THE ENTIRE formula range
                                        // from/to are selection start/end. 
                                        // If any part of selection is inside [start, end], show source.
                                        const isEditing = (from >= start && from <= end) || (to >= start && to <= end);

                                        if (!isEditing) {
                                            const fullMatch = match[0];
                                            const isBlock = fullMatch.startsWith('$$');
                                            const formula = isBlock ? fullMatch.slice(2, -2).trim() : fullMatch.slice(1, -1).trim();

                                            // Hide source
                                            decorations.push(
                                                Decoration.inline(start, end, {
                                                    class: 'tui-latex-hidden-source'
                                                })
                                            );

                                            // Show widget
                                            decorations.push(
                                                Decoration.widget(start, () => {
                                                    const dom = document.createElement('span');
                                                    dom.className = 'tui-latex-rendered-widget' + (isBlock ? ' block' : '');
                                                    dom.innerHTML = renderLatex(formula, isBlock);

                                                    dom.onclick = (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const newFormula = prompt('Edit LaTeX Formula:', formula);
                                                        if (newFormula !== null && newFormula !== formula) {
                                                            const newText = isBlock ? `$$\n${newFormula}\n$$` : `$${newFormula}$`;
                                                            if (editorView) {
                                                                const tr = editorView.state.tr.replaceWith(start, end, editorView.state.schema.text(newText));
                                                                editorView.dispatch(tr);
                                                            }
                                                        }
                                                    };
                                                    return dom;
                                                })
                                            );
                                        }
                                    }
                                }
                            });

                            return DecorationSet.create(doc, decorations);
                        }
                    }
                });
            }
        ]
    } as any;
}