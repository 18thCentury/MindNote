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
                        const { doc } = state;

                        // 匹配 $$...$$ (Block) 和 $...$ (Inline)
                        // 注意：正则需要处理跨行和转义
                        const regex = /(\$\$[^\$]*?\$\$)|(\$[^\$\n ]+\$)/g;

                        doc.descendants((node, pos) => {
                            if (node.isText && node.text) {
                                let match;
                                while ((match = regex.exec(node.text)) !== null) {
                                    const start = pos + match.index;
                                    const end = start + match[0].length;

                                    const fullMatch = match[0];
                                    const isBlock = fullMatch.startsWith('$$');
                                    const formula = isBlock
                                        ? fullMatch.slice(2, -2)
                                        : fullMatch.slice(1, -1);

                                    try {
                                        // 生成 KaTeX HTML
                                        const html = katex.renderToString(formula, {
                                            displayMode: isBlock,
                                            throwOnError: false
                                        });

                                        decorations.push(
                                            Decoration.widget(end, () => {
                                                const dom = document.createElement('span');
                                                dom.className = 'tui-editor-katex-res';
                                                dom.style.userSelect = 'none'; // 防止干扰光标选择
                                                dom.innerHTML = html;
                                                return dom;
                                            }, { side: 1 }) // side: 1 确保渲染在文本后面或上方
                                        );
                                    } catch (e) {
                                        console.error('KaTeX error:', e);
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