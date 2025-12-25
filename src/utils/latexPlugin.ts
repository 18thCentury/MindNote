import type { PluginContext, PluginInfo } from '@toast-ui/editor';
import katex from 'katex';

export function latexPlugin(context: PluginContext): PluginInfo {
    return {
        toHTMLRenderers: {
            text(node: any, context: any): any[] | null {
                const literal = node.literal || '';
                console.log(literal);


                // Optimization: if no $, just return the text node directly to be safe
                if (!literal.includes('$')) {
                    return [{ type: 'text', content: literal }];
                }

                const tokens: any[] = [];
                const combinedRegex = /(\$\$[^\$]*?\$\$)|(\$[^\$\n]+\$)/g;

                let lastIdx = 0;
                let match;

                while ((match = combinedRegex.exec(literal)) !== null) {
                    if (match.index > lastIdx) {
                        const textContent = literal.slice(lastIdx, match.index);
                        tokens.push({ type: 'text', content: textContent });
                    }

                    const fullMatch = match[0];
                    const isBlock = fullMatch.startsWith('$$');
                    let content = isBlock ? fullMatch.slice(2, -2) : fullMatch.slice(1, -1);

                    content = content.replace(/\\_/g, '_');

                    try {
                        const html = katex.renderToString(content, {
                            displayMode: isBlock,
                            throwOnError: false
                        });
                        tokens.push({ type: 'html', content: html });
                    } catch (e) {
                        tokens.push({ type: 'text', content: fullMatch });
                    }

                    lastIdx = combinedRegex.lastIndex;
                }

                if (lastIdx === 0 && tokens.length === 0) return null;

                if (lastIdx < literal.length) {
                    tokens.push({ type: 'text', content: literal.slice(lastIdx) });
                }

                // FIX: Always return the text content if no math matches were found
                if (lastIdx === 0) {
                    return [{ type: 'text', content: literal }];
                }

                return tokens;
            }
        }
    } as PluginInfo;
}
