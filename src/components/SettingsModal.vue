<script setup lang="ts">
import { ref, computed } from "vue";
import { useSettingsStore } from "../stores/settingsStore";
import { ElMessage, ElMessageBox } from "element-plus";

const props = defineProps<{
    modelValue: boolean;
}>();

const emit = defineEmits(["update:modelValue"]);

const settingsStore = useSettingsStore();
const activeTab = ref("general");

// Clone settings for editing
const localSettings = ref(JSON.parse(JSON.stringify(settingsStore.settings)));

const handleClose = () => {
    emit("update:modelValue", false);
    // Reset local settings to current store settings on close (cancel)
    localSettings.value = JSON.parse(JSON.stringify(settingsStore.settings));
};

const handleSave = async () => {
    settingsStore.settings = JSON.parse(JSON.stringify(localSettings.value));
    await settingsStore.saveSettings();
    ElMessage.success("Settings saved successfully!");
    emit("update:modelValue", false);
};

const handleReset = () => {
    settingsStore.resetSettings();
    localSettings.value = JSON.parse(JSON.stringify(settingsStore.settings));
    ElMessage.info("Settings reset to defaults.");
};

// Mindmap Theme Logic
const newThemeName = ref("");
const saveThemeVisible = ref(false);

const handleSaveTheme = () => {
    if (!newThemeName.value.trim()) {
        ElMessage.warning("Please enter a theme name.");
        return;
    }
    settingsStore.saveMindmapTheme(newThemeName.value);
    saveThemeVisible.value = false;
    newThemeName.value = "";
    // Update local settings to reflect the new active theme
    localSettings.value = JSON.parse(JSON.stringify(settingsStore.settings));
};

const handleApplyTheme = (themeId: string) => {
    settingsStore.applyMindmapTheme(themeId);
    localSettings.value = JSON.parse(JSON.stringify(settingsStore.settings));
};

const handleDeleteTheme = () => {
    if (!localSettings.value.activeMindmapTheme) return;
    
    ElMessageBox.confirm(
        "Are you sure you want to delete this theme?",
        "Warning",
        {
            confirmButtonText: "Delete",
            cancelButtonText: "Cancel",
            type: "warning",
        }
    ).then(() => {
        settingsStore.deleteMindmapTheme(localSettings.value.activeMindmapTheme!);
        localSettings.value = JSON.parse(JSON.stringify(settingsStore.settings));
    });
};

// Shortcuts Logic
const recordingShortcut = ref<string | null>(null);

const startRecording = (actionId: string) => {
    recordingShortcut.value = actionId;
};

const handleKeydown = (event: KeyboardEvent) => {
    if (!recordingShortcut.value) return;

    event.preventDefault();
    event.stopPropagation();

    const keys = [];
    if (event.ctrlKey) keys.push("Ctrl");
    if (event.shiftKey) keys.push("Shift");
    if (event.altKey) keys.push("Alt");
    if (event.metaKey) keys.push("Meta");

    if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
        keys.push(event.key.toUpperCase());
        const shortcut = keys.join("+");
        localSettings.value.shortcuts[recordingShortcut.value] = shortcut;
        recordingShortcut.value = null;
    }
};

// Theme Options
const themeOptions = [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "System", value: "system" },
];

const lineTypes = [
    { label: "Default", value: "default" },
    { label: "Straight", value: "straight" },
    { label: "Step", value: "step" },
    { label: "Smooth Step", value: "smoothstep" },
    { label: "Bezier", value: "bezier" },
];

const patterns = [
    { label: "Dots", value: "dots" },
    { label: "Lines", value: "lines" },
    { label: "Cross", value: "cross" },
    { label: "None", value: "none" },
];
</script>

<template>
    <el-dialog
        :model-value="modelValue"
        title="Settings"
        width="600px"
        @close="handleClose"
        :close-on-click-modal="false"
        @keydown="handleKeydown"
    >
        <el-tabs v-model="activeTab">
            <el-tab-pane label="General" name="general">
                <el-form label-position="top">
                    <el-form-item label="Theme">
                        <el-select v-model="localSettings.theme">
                            <el-option
                                v-for="item in themeOptions"
                                :key="item.value"
                                :label="item.label"
                                :value="item.value"
                            />
                        </el-select>
                    </el-form-item>

                    <el-divider content-position="left">Mindmap Theme</el-divider>
                    <div class="theme-controls">
                        <el-select 
                            v-model="localSettings.activeMindmapTheme" 
                            placeholder="Select a theme" 
                            clearable
                            @change="handleApplyTheme"
                            style="flex: 1"
                        >
                            <el-option
                                v-for="theme in localSettings.mindmapThemes"
                                :key="theme.id"
                                :label="theme.name"
                                :value="theme.id"
                            />
                        </el-select>
                        <el-button @click="saveThemeVisible = true">Save As New</el-button>
                        <el-button 
                            type="danger" 
                            :disabled="!localSettings.activeMindmapTheme"
                            @click="handleDeleteTheme"
                        >
                            Delete
                        </el-button>
                    </div>

                    <el-divider content-position="left">Node Style</el-divider>
                    <div class="style-group">
                        <el-form-item label="Background Color">
                            <el-color-picker v-model="localSettings.nodeStyle.backgroundColor" />
                        </el-form-item>
                        <el-form-item label="Border Color">
                            <el-color-picker v-model="localSettings.nodeStyle.borderColor" />
                        </el-form-item>
                        <el-form-item label="Text Color">
                            <el-color-picker v-model="localSettings.nodeStyle.textColor" />
                        </el-form-item>
                        <el-form-item label="Border Width">
                            <el-input-number v-model="localSettings.nodeStyle.borderWidth" :min="0" :max="10" />
                        </el-form-item>
                        <el-form-item label="Border Radius">
                            <el-input-number v-model="localSettings.nodeStyle.borderRadius" :min="0" :max="20" />
                        </el-form-item>
                    </div>

                    <el-divider content-position="left">Selected Node Style</el-divider>
                    <div class="style-group">
                        <el-form-item label="Background Color">
                            <el-color-picker v-model="localSettings.selectedNodeStyle.backgroundColor" />
                        </el-form-item>
                        <el-form-item label="Border Color">
                            <el-color-picker v-model="localSettings.selectedNodeStyle.borderColor" />
                        </el-form-item>
                        <el-form-item label="Text Color">
                            <el-color-picker v-model="localSettings.selectedNodeStyle.textColor" />
                        </el-form-item>
                        <el-form-item label="Border Width">
                            <el-input-number v-model="localSettings.selectedNodeStyle.borderWidth" :min="0" :max="10" />
                        </el-form-item>
                    </div>

                    <el-divider content-position="left">Line Style</el-divider>
                    <div class="style-group">
                        <el-form-item label="Color">
                            <el-color-picker v-model="localSettings.lineStyle.stroke" />
                        </el-form-item>
                        <el-form-item label="Width">
                            <el-input-number v-model="localSettings.lineStyle.strokeWidth" :min="1" :max="10" />
                        </el-form-item>
                        <el-form-item label="Type">
                            <el-select v-model="localSettings.lineStyle.type">
                                <el-option
                                    v-for="item in lineTypes"
                                    :key="item.value"
                                    :label="item.label"
                                    :value="item.value"
                                />
                            </el-select>
                        </el-form-item>
                    </div>

                    <el-divider content-position="left">Background Style</el-divider>
                    <div class="style-group">
                        <el-form-item label="Color">
                            <el-color-picker v-model="localSettings.backgroundStyle.color" />
                        </el-form-item>
                        <el-form-item label="Pattern">
                            <el-select v-model="localSettings.backgroundStyle.pattern">
                                <el-option
                                    v-for="item in patterns"
                                    :key="item.value"
                                    :label="item.label"
                                    :value="item.value"
                                />
                            </el-select>
                        </el-form-item>
                    </div>

                    <el-divider content-position="left">Layout Style</el-divider>
                    <div class="style-group">
                        <el-form-item label="Horizontal Gap">
                            <el-input-number v-model="localSettings.layoutStyle.horizontalGap" :min="50" :max="300" :step="10" />
                        </el-form-item>
                        <el-form-item label="Vertical Gap">
                            <el-input-number v-model="localSettings.layoutStyle.verticalGap" :min="10" :max="100" :step="5" />
                        </el-form-item>
                    </div>
                </el-form>
            </el-tab-pane>

            <el-tab-pane label="Shortcuts" name="shortcuts">
                <el-table :data="Object.entries(localSettings.shortcuts)" style="width: 100%">
                    <el-table-column prop="0" label="Action" width="180">
                        <template #default="scope">
                            {{ scope.row[0].replace('file:', 'File: ') }}
                        </template>
                    </el-table-column>
                    <el-table-column prop="1" label="Shortcut">
                        <template #default="scope">
                            <el-tag
                                v-if="recordingShortcut !== scope.row[0]"
                                @click="startRecording(scope.row[0])"
                                class="shortcut-tag"
                            >
                                {{ scope.row[1] }}
                            </el-tag>
                            <el-tag v-else type="warning">Press keys...</el-tag>
                        </template>
                    </el-table-column>
                </el-table>
                <div class="shortcut-tip">
                    Click on a shortcut to record a new one.
                </div>
            </el-tab-pane>
        </el-tabs>

        <template #footer>
            <span class="dialog-footer">
                <el-button @click="handleReset">Reset Defaults</el-button>
                <el-button @click="handleClose">Cancel</el-button>
                <el-button type="primary" @click="handleSave">Save</el-button>
            </span>
        </template>
    </el-dialog>

    <el-dialog
        v-model="saveThemeVisible"
        title="Save Theme"
        width="400px"
    >
        <el-input v-model="newThemeName" placeholder="Theme Name" @keyup.enter="handleSaveTheme" />
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="saveThemeVisible = false">Cancel</el-button>
                <el-button type="primary" @click="handleSaveTheme">Save</el-button>
            </span>
        </template>
    </el-dialog>
</template>

<style scoped>
.style-group {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
}

.theme-controls {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.shortcut-tag {
    cursor: pointer;
}

.shortcut-tip {
    margin-top: 10px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
}
</style>
