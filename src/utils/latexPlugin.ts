import { PluginContext, PluginInfo } from '@toast-ui/editor';
import { Decoration, DecorationSet } from 'prosemirror-view';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// --- 工具函数 ---
const renderLatex = (content: string, isBlock: boolean) => {
    try {
        return katex.renderToString(content, {
            displayMode: isBlock,
            throwOnError: false,
            macros: { "\\_": "_" }
        });
    } catch (e) {
        return `<span>${content}</span>`;
    }
};

const escapeHtml = (text: string) => {
    return text.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]!));
};

// --- 核心正则 ---
// Global regex for matching LaTeX blocks ($$ ... $$) and inline ($ ... $)
const LATEX_RE = /(\$\$[\s\S]+?\$\$)|(\$[^\$\n]+?\$)/g;

export function latexPlugin(context: PluginContext): PluginInfo {
    const { pmState } = context;

    return {
        toHTMLRenderers: {
            customInline(node: any) {
                return { type: 'text', content: "" };
            },

            text(node: any) {
                try {
                    // If not a valid text node or no LaTeX, return null to use default renderer
                    if (!node || typeof node.literal !== 'string' || !node.literal.includes('$')) {
                        return { type: 'text', content: node.literal || '' };
                    }

                    const literal = node.literal;

                    // Stateless matching using a new regex literal or matchAll
                    const matches = Array.from(literal.matchAll(new RegExp(LATEX_RE.source, 'g')));
                    if (matches.length === 0) return { type: 'text', content: node.literal || '' };

                    let lastIdx = 0;
                    let resultHtml = '';

                    for (const matchObj of matches) {
                        const match = matchObj as RegExpMatchArray;
                        const index = match.index!;
                        // 处理公式前的文本
                        if (index > lastIdx) {
                            resultHtml += escapeHtml(literal.slice(lastIdx, index));
                        }

                        const fullMatch = match[0];
                        const isBlock = fullMatch.startsWith('$$');
                        const formula = isBlock ? fullMatch.slice(2, -2) : fullMatch.slice(1, -1);
                        // 还原被 Markdown 转义的字符
                        const cleanFormula = formula.replace(/\\([_<>\\$])/g, '$1');

                        resultHtml += renderLatex(cleanFormula, false);
                        lastIdx = index + fullMatch.length;
                    }

                    // 处理剩余文本
                    if (lastIdx < literal.length) {
                        resultHtml += escapeHtml(literal.slice(lastIdx));
                    }

                    // Return structured array for better compatibility with TUI's VDOM/HTML conversion
                    return [
                        { type: 'openTag', tagName: 'span', attrs: { class: 'tui-latex-container' } },
                        { type: 'html', content: resultHtml },
                        { type: 'closeTag', tagName: 'span' }
                    ];
                } catch (error) {
                    return { type: 'text', content: node ? node.literal : '' };
                }
            }
        },

        // 2. WYSIWYG 编辑器渲染 (ProseMirror Decorations)
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
                            try {
                                const decorations: any[] = [];
                                if (!state || !state.doc || !state.selection) {
                                    return DecorationSet.empty;
                                }
                                const { doc, selection } = state;
                                const { from, to } = selection;

                                doc.descendants((node: any, pos: number) => {
                                    if (node.isText && node.text) {
                                        let match;
                                        // 每次执行前重置正则索引
                                        LATEX_RE.lastIndex = 0;

                                        while ((match = LATEX_RE.exec(node.text)) !== null) {
                                            const start = pos + match.index;
                                            const end = start + match[0].length;

                                            // 光标不在公式内时进行渲染
                                            const isEditing = (from >= start && from <= end) || (to >= start && to <= end);

                                            if (!isEditing) {
                                                const fullMatch = match[0];
                                                const isBlock = fullMatch.startsWith('$$');
                                                const formula = (isBlock ? fullMatch.slice(2, -2) : fullMatch.slice(1, -1)).trim();
                                                const cleanFormula = formula.replace(/\\([_<>\\$])/g, '$1');

                                                // 隐藏源码
                                                decorations.push(Decoration.inline(start, end, {
                                                    style: 'display:none'
                                                }));

                                                // 插入渲染部件
                                                decorations.push(Decoration.widget(start, () => {
                                                    const dom = document.createElement('span');
                                                    dom.className = `tui-latex-res-widget ${isBlock ? 'is-block' : 'is-inline'}`;
                                                    dom.innerHTML = renderLatex(cleanFormula, isBlock);

                                                    // 点击编辑逻辑
                                                    dom.onclick = (e) => {
                                                        e.preventDefault();
                                                        const newFormula = prompt('编辑 LaTeX:', cleanFormula);
                                                        if (newFormula !== null && newFormula !== cleanFormula) {
                                                            const newText = isBlock ? `$$\n${newFormula}\n$$` : `$${newFormula}$`;
                                                            const tr = editorView.state.tr.replaceWith(start, end, editorView.state.schema.text(newText));
                                                            editorView.dispatch(tr);
                                                        }
                                                    };
                                                    return dom;
                                                }, { side: -1 }));
                                            }
                                        }
                                    }
                                });
                                return DecorationSet.create(doc, decorations);
                            } catch (error) {
                                console.warn('[LaTeX Plugin] Error in WYSIWYG decorations:', error);
                                return DecorationSet.empty;
                            }
                        }
                    }
                });
            }
        ]
    };
}