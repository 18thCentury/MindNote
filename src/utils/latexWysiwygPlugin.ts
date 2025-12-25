import { PluginContext, PluginInfo } from '@toast-ui/editor';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function latexWysiwygPlugin(context: PluginContext): PluginInfo {
    return {
        wysiwygPlugins: [
            () => new Plugin({
                props: {
                    decorations(state) {
                        const decorations: Decoration[] = [];
                        const { doc, selection } = state;
                        const { from, to } = selection;

                        const regex = /(\$\$[^\$]+\$\$)|(\$[^\$\n]+\$)/g;

                        doc.descendants((node, pos) => {
                            if (node.isText && node.text) {
                                let match;
                                while ((match = regex.exec(node.text)) !== null) {
                                    const start = pos + match.index;
                                    const end = start + match[0].length;

                                    // 判断光标是否在公式内
                                    const isEditing = from >= start && to <= end;

                                    if (!isEditing) {
                                        const fullMatch = match[0];
                                        const isBlock = fullMatch.startsWith('$$');
                                        const formula = isBlock ? fullMatch.slice(2, -2) : fullMatch.slice(1, -1);

                                        try {
                                            const html = katex.renderToString(formula, {
                                                displayMode: isBlock,
                                                throwOnError: false,
                                            });

                                            // 1. 隐藏原始文本：添加一个自定义 class
                                            decorations.push(
                                                Decoration.inline(start, end, {
                                                    class: 'hidden-latex-source',
                                                })
                                            );

                                            // 2. 在相同位置渲染 KaTeX Widget
                                            decorations.push(
                                                Decoration.widget(start, () => {
                                                    const dom = document.createElement('span');
                                                    dom.className = 'tui-editor-katex-rendered';
                                                    dom.innerHTML = html;
                                                    return dom;
                                                })
                                            );
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    }
                                }
                            }
                        });

                        return DecorationSet.create(doc, decorations);
                    }
                }
            })
        ]
    };
}