import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { ipcRenderer } from "../utils/ipcRenderer";
import { IPC_EVENTS, AppSettings, MindmapTheme } from "@/types/shared_types";
import { ElMessage } from "element-plus";

import { v4 as uuidv4 } from "uuid";

const DEFAULT_SETTINGS: AppSettings = {
    theme: "system",
    nodeStyle: {
        backgroundColor: "#ffffff",
        borderColor: "#000000",
        borderWidth: 1,
        borderRadius: 4,
        textColor: "#000000",
    },
    selectedNodeStyle: {
        backgroundColor: "#e6f7ff",
        borderColor: "#1890ff",
        borderWidth: 2,
        textColor: "#000000",
    },
    lineStyle: {
        stroke: "#333333",
        strokeWidth: 2,
        type: "smoothstep",
    },
    backgroundStyle: {
        color: "#f0f2f5",
        pattern: "dots",
    },
    layoutStyle: {
        horizontalGap: 100,
        verticalGap: 20,
    },
    shortcuts: {
        "file:new": "Ctrl+N",
        "file:open": "Ctrl+O",
        "file:save": "Ctrl+S",
        "file:save-as": "Ctrl+Shift+S",
        "file:close": "Ctrl+W",
    },
    mindmapThemes: [],
    activeMindmapTheme: null,
};

export const useSettingsStore = defineStore("settings", () => {
    const settings = ref<AppSettings>(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));

    const loadSettings = async () => {
        try {
            const savedSettings = await ipcRenderer.invoke(IPC_EVENTS.SETTINGS_READ);
            if (savedSettings) {
                // Merge saved settings with defaults
                settings.value = { ...DEFAULT_SETTINGS, ...savedSettings };

                // Deep merge for nested objects
                if (savedSettings.nodeStyle) settings.value.nodeStyle = { ...DEFAULT_SETTINGS.nodeStyle, ...savedSettings.nodeStyle };
                if (savedSettings.selectedNodeStyle) settings.value.selectedNodeStyle = { ...DEFAULT_SETTINGS.selectedNodeStyle, ...savedSettings.selectedNodeStyle };
                if (savedSettings.lineStyle) settings.value.lineStyle = { ...DEFAULT_SETTINGS.lineStyle, ...savedSettings.lineStyle };
                if (savedSettings.backgroundStyle) settings.value.backgroundStyle = { ...DEFAULT_SETTINGS.backgroundStyle, ...savedSettings.backgroundStyle };
                if (savedSettings.layoutStyle) settings.value.layoutStyle = { ...DEFAULT_SETTINGS.layoutStyle, ...savedSettings.layoutStyle };
                if (savedSettings.shortcuts) settings.value.shortcuts = { ...DEFAULT_SETTINGS.shortcuts, ...savedSettings.shortcuts };
                // Arrays and primitives are overwritten by spread above, which is fine for themes
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        }
    };

    const saveSettings = async () => {
        try {
            await ipcRenderer.invoke(IPC_EVENTS.SETTINGS_WRITE, JSON.parse(JSON.stringify(settings.value)));
        } catch (error) {
            console.error("Failed to save settings:", error);
            ElMessage.error("Failed to save settings");
        }
    };

    // Auto-save when settings change
    watch(
        settings,
        () => {
            saveSettings();
        },
        { deep: true }
    );

    const resetSettings = () => {
        settings.value = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    };

    // Theme Actions
    const saveMindmapTheme = (name: string) => {
        const newTheme: MindmapTheme = {
            id: uuidv4(),
            name,
            nodeStyle: { ...settings.value.nodeStyle },
            selectedNodeStyle: { ...settings.value.selectedNodeStyle },
            lineStyle: { ...settings.value.lineStyle },
            backgroundStyle: { ...settings.value.backgroundStyle },
            layoutStyle: { ...settings.value.layoutStyle },
        };
        settings.value.mindmapThemes.push(newTheme);
        settings.value.activeMindmapTheme = newTheme.id;
        ElMessage.success(`Theme "${name}" saved.`);
    };

    const applyMindmapTheme = (themeId: string) => {
        const theme = settings.value.mindmapThemes.find((t) => t.id === themeId);
        if (theme) {
            settings.value.nodeStyle = { ...theme.nodeStyle };
            settings.value.selectedNodeStyle = { ...theme.selectedNodeStyle };
            settings.value.lineStyle = { ...theme.lineStyle };
            settings.value.backgroundStyle = { ...theme.backgroundStyle };
            settings.value.layoutStyle = { ...theme.layoutStyle };
            settings.value.activeMindmapTheme = themeId;
            ElMessage.success(`Theme "${theme.name}" applied.`);
        }
    };

    const deleteMindmapTheme = (themeId: string) => {
        const index = settings.value.mindmapThemes.findIndex((t) => t.id === themeId);
        if (index !== -1) {
            settings.value.mindmapThemes.splice(index, 1);
            if (settings.value.activeMindmapTheme === themeId) {
                settings.value.activeMindmapTheme = null;
            }
            ElMessage.success("Theme deleted.");
        }
    };

    return {
        settings,
        loadSettings,
        saveSettings,
        resetSettings,
        saveMindmapTheme,
        applyMindmapTheme,
        deleteMindmapTheme,
    };
});

