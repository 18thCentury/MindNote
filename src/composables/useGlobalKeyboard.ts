import { onMounted, onBeforeUnmount } from 'vue';
import { isInputActive, isModalOpen } from '../utils/keyboardUtils';

interface KeyboardOptions {
    ignoreInput?: boolean;
    ignoreModal?: boolean;
}

export function useGlobalKeyboard(handler: (e: KeyboardEvent) => void, options: KeyboardOptions = {}) {
    const { ignoreInput = true, ignoreModal = true } = options;

    const listener = (e: KeyboardEvent) => {
        if (ignoreModal && isModalOpen()) return;
        if (ignoreInput && isInputActive(e)) return;

        handler(e);
    };

    onMounted(() => window.addEventListener('keydown', listener));
    onBeforeUnmount(() => window.removeEventListener('keydown', listener));
}
