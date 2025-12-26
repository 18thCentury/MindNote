
// We assume access to the underlying ProseMirror view from Toast UI Editor
// Access types if available, otherwise use any
import { Editor } from "@toast-ui/editor";

// Helper to get the ProseMirror View
export const getProseMirrorView = (editorInstance: Editor): any => {
    if (!editorInstance) return null;
    const isMarkdown = editorInstance.isMarkdownMode();
    // Use type assertion or access internal properties
    // @ts-ignore
    const mdEditor = editorInstance.mdEditor;
    // @ts-ignore
    const wwEditor = editorInstance.wwEditor;

    return isMarkdown ? mdEditor.view : wwEditor.view;
};

interface SearchResult {
    from: number;
    to: number;
}

export const findNext = (editorInstance: Editor, searchText: string): void => {
    const view = getProseMirrorView(editorInstance);
    if (!view || !searchText) return;

    const { state, dispatch } = view;
    const { doc, selection } = state;

    // Simple text search in the document
    // Note: This searches text content. Depending on structure, it might cross node boundaries if not careful.
    // For TUI Editor, usually text is fairly continuous or blocked.
    // We'll use doc.textBetween to get a string but we need to map back to positions.
    // Efficient way: doc.descendants

    let found: SearchResult | null = null;
    const startPos = selection.to; // Start searching after current cursor

    // Helper to search in a range
    const searchInRange = (from: number, to: number): SearchResult | null => {
        let match: SearchResult | null = null;
        doc.nodesBetween(from, to, (node: any, pos: number) => {
            if (match) return false; // Stop if found
            if (node.isText) {
                const text = node.text!;
                // Calculate effective start and end to search within this node
                const nodeStart = Math.max(0, from - pos);
                const nodeEnd = Math.min(text.length, to - pos);

                if (nodeStart < nodeEnd) {
                    const subText = text.slice(nodeStart, nodeEnd);
                    const idx = subText.toLowerCase().indexOf(searchText.toLowerCase()); // Case insensitive
                    if (idx !== -1) {
                        match = {
                            from: pos + nodeStart + idx,
                            to: pos + nodeStart + idx + searchText.length
                        };
                        return false;
                    }
                }
            }
            return true;
        });
        return match;
    };

    // 1. Search from cursor to end
    found = searchInRange(startPos, doc.content.size);

    // 2. If not found, wrap around (search from start to cursor)
    if (!found) {
        found = searchInRange(0, startPos);
    }

    if (found) {
        moveSelection(view, found.from, found.to);
    }
};

export const findPrev = (editorInstance: Editor, searchText: string): void => {
    const view = getProseMirrorView(editorInstance);
    if (!view || !searchText) return;

    const { state } = view;
    const { doc, selection } = state;

    let found: SearchResult | null = null;
    const startPos = selection.from;

    // We need to find the LAST match before startPos
    // Iterating nodesBetween is usually forward.
    // We can collect all matches and pick best.

    const allMatches = findAllMatches(doc, searchText);

    if (allMatches.length === 0) return;

    // Find match immediately preceding startPos
    // Filter matches that end before or at startPos?
    // Usually prev means strictly before current selection starts

    // Sort matches by pos
    // Find last match where match.from < startPos

    let prevMatch = null;
    for (let i = allMatches.length - 1; i >= 0; i--) {
        if (allMatches[i].from < startPos) {
            prevMatch = allMatches[i];
            break;
        }
    }

    if (prevMatch) {
        found = prevMatch;
    } else {
        // Wrap around to last match
        found = allMatches[allMatches.length - 1];
    }

    if (found) {
        moveSelection(view, found.from, found.to);
    }
};

export const replaceCurrent = (editorInstance: Editor, searchText: string, replaceText: string): void => {
    const view = getProseMirrorView(editorInstance);
    if (!view) return;

    const { state, dispatch } = view;
    const { selection, doc } = state;
    if (selection.empty) return;

    // Check if current selection matches search text
    // Get text at selection
    const selectedText = doc.textBetween(selection.from, selection.to);

    if (selectedText.toLowerCase() === searchText.toLowerCase()) {
        const tr = state.tr.insertText(replaceText, selection.from, selection.to);
        dispatch(tr.scrollIntoView());

        // After replace, try to find next?
        // findNext(editorInstance, searchText);
    } else {
        // If not selected, maybe find next matching?
        findNext(editorInstance, searchText);
    }
};

export const replaceAll = (editorInstance: Editor, searchText: string, replaceText: string): number => {
    const view = getProseMirrorView(editorInstance);
    if (!view || !searchText) return 0;

    const { state, dispatch } = view;
    const { doc } = state;

    const matches = findAllMatches(doc, searchText);
    if (matches.length === 0) return 0;

    let tr = state.tr;

    // Iterate backwards to keep positions valid
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        tr = tr.insertText(replaceText, match.from, match.to);
    }

    dispatch(tr);
    return matches.length;
};


// Internal helper
function findAllMatches(doc: any, searchText: string): SearchResult[] {
    const matches: SearchResult[] = [];
    doc.descendants((node: any, pos: number) => {
        if (node.isText) {
            const text = node.text!;
            let idx = text.toLowerCase().indexOf(searchText.toLowerCase());
            while (idx !== -1) {
                matches.push({
                    from: pos + idx,
                    to: pos + idx + searchText.length
                });
                idx = text.toLowerCase().indexOf(searchText.toLowerCase(), idx + 1);
            }
        }
    });
    return matches;
}

function moveSelection(view: any, from: number, to: number) {
    const { state, dispatch } = view;
    // We need to construct a TextSelection
    // Since we don't import TextSelection class (it's in prosemirror-state),
    // and we might not have it in dependencies directly accessible or want to avoid mismatch.
    // We can rely on view.state.tr.setSelection(TextSelection.create(...))
    // But we need the Class.

    // Access it from state constructor?
    const TextSelection = state.selection.constructor;

    try {
        const tr = state.tr.setSelection(TextSelection.create(state.doc, from, to));
        dispatch(tr.scrollIntoView());
    } catch (e) {
        console.error("Failed to set selection", e);
    }
}
