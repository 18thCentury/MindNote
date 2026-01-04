import { NodeStyle } from "../types/shared_types";

class DOMMeasurer {
    private static instance: DOMMeasurer;
    private cachedStandardDimensions: { width: number; height: number } | null = null;

    private constructor() { }

    public static getInstance(): DOMMeasurer {
        if (!DOMMeasurer.instance) {
            DOMMeasurer.instance = new DOMMeasurer();
        }
        return DOMMeasurer.instance;
    }

    /**
     * Clears the cached standard dimensions.
     * Call this when theme or global styles change.
     */
    public clearCache() {
        this.cachedStandardDimensions = null;
    }

    /**
     * Gets the dimensions for a standard "New Node" string.
     * Caches the result to avoid repeated DOM operations.
     * @param style Current node style from settings
     */
    public getStandardDimensions(style: NodeStyle): { width: number; height: number } {
        if (this.cachedStandardDimensions) {
            return this.cachedStandardDimensions;
        }

        const dimensions = this.measureNode("New Node", style);
        this.cachedStandardDimensions = dimensions;
        return dimensions;
    }

    /**
     * Measures a node's dimensions by rendering it into a hidden DOM element.
     * This ensures all CSS (scoped, global, theme) is applied correctly.
     * @param text Text to measure
     * @param style Current node style configuration
     */
    public measureNode(text: string, style: NodeStyle): { width: number; height: number } {
        // 1. Create container matching the MindmapCustomNode structure
        const nodeEl = document.createElement("div");
        nodeEl.className = "custom-node"; // Matches the class in MindmapCustomNode.vue

        // 2. Apply dynamic styles from SettingsStore match logic in MindmapCustomNode
        nodeEl.style.backgroundColor = style.backgroundColor;
        nodeEl.style.borderColor = style.borderColor;
        nodeEl.style.borderWidth = `${style.borderWidth}px`;
        nodeEl.style.borderRadius = `${style.borderRadius}px`;
        nodeEl.style.color = style.textColor;

        // 3. Apply sizing critical styles to ensure measurement works 
        // (We duplicate key layout styles from MindmapCustomNode.vue <style scoped>)
        // Since scoped styles won't apply to this dynamic element, we must inline key layout properties.
        // Based on inspection of MindmapCustomNode.vue:
        nodeEl.style.padding = "8px 12px";
        nodeEl.style.minWidth = "80px";
        nodeEl.style.textAlign = "center";
        nodeEl.style.borderStyle = "solid";
        nodeEl.style.display = "inline-block"; // or box-sizing border-box logic
        nodeEl.style.position = "absolute";
        nodeEl.style.visibility = "hidden";
        nodeEl.style.top = "-9999px";
        nodeEl.style.left = "-9999px";
        nodeEl.style.whiteSpace = "nowrap"; // Assuming default, but safeguard

        // Font styles should inherit from body or be set if specific
        // Note: If MindmapCustomNode has specific font settings, they should be added here too.
        // Assuming standard inheritance for now, or added via global CSS.

        // 4. Content Structure
        // <div class="node-content"><span class="node-text">{{ text }}</span></div>
        const contentEl = document.createElement("div");
        contentEl.className = "node-content";
        contentEl.style.display = "flex";
        contentEl.style.alignItems = "center";
        contentEl.style.justifyContent = "center";
        contentEl.style.gap = "4px";

        const textEl = document.createElement("span");
        textEl.className = "node-text";
        textEl.textContent = text;

        contentEl.appendChild(textEl);
        nodeEl.appendChild(contentEl);

        // 5. Append to body to render
        document.body.appendChild(nodeEl);

        // 6. Measure
        const rect = nodeEl.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // 7. Cleanup
        document.body.removeChild(nodeEl);

        return { width, height };
    }
}

export const domMeasurer = DOMMeasurer.getInstance();
