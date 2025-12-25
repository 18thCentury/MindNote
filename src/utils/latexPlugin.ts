import type { PluginContext, PluginInfo } from '@toast-ui/editor';
import katex from 'katex';

export function latexPlugin(context: PluginContext): PluginInfo {
    return {
        // specific to TUI Editor v3 to enable widget rules in WYSIWYG
        widgetRules: [
            {
                // Block math $$ ... $$
                rule: /\$\$([\s\S]*?)\$\$/g,
                toDOM(text: string) {
                    // KEY FIX: Use 'span' instead of 'div' because TUI editor (prosemirror) 
                    // might be inserting this inside a paragraph. 
                    // Putting a div inside a p is invalid HTML and can cause split-paragraphs behavior.
                    const el = document.createElement('span');
                    el.className = 'katex-block-widget';
                    // Use inline-flex or flex to behave like a block visually but be safe in inline contexts if needed
                    // Or strictly 'block' if we are sure TUI handles it. 
                    // But 'span' with display: block is safer than 'div' regarding parser behavior.
                    el.style.display = 'flex';
                    el.style.justifyContent = 'center';
                    el.style.width = '100%';

                    let expression = text.substring(2, text.length - 2);
                    expression = expression.replace(/\\_/g, '_');

                    try {
                        katex.render(expression, el, { displayMode: true, throwOnError: false });
                    } catch (e) {
                        el.textContent = 'Invalid Formula';
                    }
                    return el;
                },
            },
            {
                // Inline math $ ... $
                rule: /\$([^$\n]+)\$/g,
                toDOM(text: string) {
                    const el = document.createElement('span');
                    el.className = 'katex-inline-widget';

                    let expression = text.substring(1, text.length - 1);
                    expression = expression.replace(/\\_/g, '_');

                    try {
                        katex.render(expression, el, { displayMode: false, throwOnError: false });
                    } catch (e) {
                        el.textContent = 'Invalid Formula';
                    }
                    return el;
                },
            }
        ],

        toHTMLRenderers: {
            text(node: any, context: any): any[] | null {
                const literal = node.literal || '';
                // Optimization: if no $, just return the text node directly to be safe
                if (!literal.includes('$')) {
                    return [{ type: 'text', content: literal }];
                }

                const tokens: any[] = [];
                const combinedRegex = /(\$\$[^$\n]*?\$\$)|(\$[^$\n]+\$)/g;

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
