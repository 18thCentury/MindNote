import { PluginContext, PluginInfo } from '@toast-ui/editor';
import { Decoration, DecorationSet } from 'prosemirror-view';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// --- 渲染辅助函数 ---
const renderLatex = (content: string, isBlock: boolean) => {
    try {
        return katex.renderToString(content, {
            displayMode: isBlock,
            throwOnError: false,
            // 解决 Markdown 解析器可能转义反斜杠的问题
            macros: { "\\_": "_" }
        });
    } catch (e) {
        console.error('KaTeX error:', e);
        return `<span style="color: red;">${content}</span>`;
    }
};

export function latexPlugin(context: PluginContext): PluginInfo {
    const { pmState } = context;

    return {
        // 1. Markdown 模式渲染修复 (解决预览区不显示问题)
        toHTMLRenderers: {
            text(node: any) {
                const literal = node.literal || '';
                // 快速跳过不含 $ 的文本

                if (!literal.includes('$')) {
                    return {
                        type: 'text',
                        content: literal
                    };
                }
                // if (!literal.includes('$')) return null;

                // 这里的正则需要非常严谨，防止匹配过头
                const regex = /(\$\$[\s\S]+?\$\$)|(\$[^\$\n]+?\$)/g;
                const tokens: any[] = [];
                let lastIdx = 0;
                let match;

                while ((match = regex.exec(literal)) !== null) {
                    // 处理公式前的普通文本
                    if (match.index > lastIdx) {
                        tokens.push({
                            type: 'text',
                            content: literal.slice(lastIdx, match.index)
                        });
                    }

                    const fullMatch = match[0];
                    const isBlock = fullMatch.startsWith('$$');
                    // 提取公式内容并处理常见的 Markdown 转义干扰
                    let formula = isBlock ? fullMatch.slice(2, -2) : fullMatch.slice(1, -1);
                    formula = formula.replace(/\\([_<>])/g, '$1'); // 还原被编辑器转义的字符

                    tokens.push({
                        type: 'html',
                        content: isBlock
                            ? `<div class="katex-block">${renderLatex(formula, true)}</div>`
                            : renderLatex(formula, false)
                    });

                    lastIdx = regex.lastIndex;
                }

                // 处理公式后的普通文本
                if (lastIdx < literal.length) {
                    tokens.push({
                        type: 'text',
                        content: literal.slice(lastIdx)
                    });
                }

                return tokens.length > 0 ? tokens : null;
            }
        },

        // 2. WYSIWYG 模式渲染 (基于 ProseMirror Decorations)
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

                            // 这里的正则与上面保持一致
                            const regex = /(\$\$[\s\S]+?\$\$)|(\$[^\$\n]+?\$)/g;

                            doc.descendants((node: any, pos: number) => {
                                if (node.isText && node.text) {
                                    let match;
                                    while ((match = regex.exec(node.text)) !== null) {
                                        const start = pos + match.index;
                                        const end = start + match[0].length;

                                        // 检查光标是否在公式内部（如果在，显示源码以便编辑）
                                        const isEditing = (from >= start && from <= end) || (to >= start && to <= end);

                                        if (!isEditing) {
                                            const fullMatch = match[0];
                                            const isBlock = fullMatch.startsWith('$$');
                                            let formula = isBlock ? fullMatch.slice(2, -2).trim() : fullMatch.slice(1, -1).trim();
                                            formula = formula.replace(/\\([_<>])/g, '$1');

                                            // 1. 隐藏原始文本
                                            decorations.push(
                                                Decoration.inline(start, end, {
                                                    style: 'display: none' // 也可以用 class
                                                })
                                            );

                                            // 2. 插入渲染后的部件
                                            decorations.push(
                                                Decoration.widget(start, () => {
                                                    const dom = document.createElement('span');
                                                    dom.className = 'tui-latex-widget' + (isBlock ? ' block' : '');
                                                    dom.style.cursor = 'pointer';
                                                    dom.innerHTML = renderLatex(formula, isBlock);

                                                    // 点击交互逻辑
                                                    dom.onclick = (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const newFormula = prompt('编辑 LaTeX 公式:', formula);
                                                        if (newFormula !== null && newFormula !== formula) {
                                                            const newText = isBlock ? `$$\n${newFormula}\n$$` : `$${newFormula}$`;
                                                            const tr = editorView.state.tr.replaceWith(start, end, editorView.state.schema.text(newText));
                                                            editorView.dispatch(tr);
                                                        }
                                                    };
                                                    return dom;
                                                }, { side: -1 }) // 确保 widget 渲染在隐藏文本之前
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
    };
}