import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import Header from '../Header.vue';
import { createTestingPinia } from '@pinia/testing';

// Mock ipcRenderer
vi.mock('../../utils/ipcRenderer', () => ({
    ipcRenderer: {
        minimizeWindow: vi.fn(),
        maximizeWindow: vi.fn(),
        closeWindow: vi.fn(),
    }
}));

describe('Header.vue', () => {
    it('renders application title', () => {
        const wrapper = mount(Header, {
            global: {
                plugins: [createTestingPinia({
                    createSpy: vi.fn,
                })],
                stubs: {
                    'el-menu': true,
                    'el-sub-menu': true,
                    'el-menu-item': true,
                    'el-icon': true,
                    'SettingsModal': true
                }
            }
        });

        expect(wrapper.find('.app-title').text()).toBe('MindNote');
    });

    it('displays current file name when provided', () => {
        const wrapper = mount(Header, {
            global: {
                plugins: [createTestingPinia({
                    createSpy: vi.fn,
                    initialState: {
                        file: { // Assuming store id is 'file'
                            currentFilePath: 'C:\\Users\\Test\\Documents\\MyMindMap.mn'
                        }
                    }
                })],
                stubs: {
                    'el-menu': true,
                    'el-sub-menu': true,
                    'el-menu-item': true,
                    'el-icon': true,
                    'SettingsModal': true
                }
            }
        });
        // The component logic splits by '/' or '\' and takes the last part
        expect(wrapper.find('.file-name').text()).toBe('MyMindMap.mn');
    });
});
