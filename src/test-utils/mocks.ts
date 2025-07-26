/**
 * Моки для тестирования
 */

import { vi } from "vitest";

/**
 * Мок для EventEmitter
 */
export class MockEventEmitter {
    private listeners: Map<string, Function[]> = new Map();

    on = vi.fn((event: string, listener: Function) => {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
        return this;
    });

    emit = vi.fn((event: string, ...args: any[]) => {
        const eventListeners = this.listeners.get(event) || [];
        eventListeners.forEach((listener) => listener(...args));
        return eventListeners.length > 0;
    });

    off = vi.fn((event: string, listener: Function) => {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(listener);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
        return this;
    });

    removeAllListeners = vi.fn((event?: string) => {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
        return this;
    });

    getListeners(event: string): Function[] {
        return this.listeners.get(event) || [];
    }

    hasListeners(event: string): boolean {
        return this.getListeners(event).length > 0;
    }
}

/**
 * Мок для таймеров
 */
export const mockTimers = {
    setTimeout: vi.fn((callback: Function, delay: number) => {
        return setTimeout(callback, delay);
    }),
    clearTimeout: vi.fn((id: NodeJS.Timeout) => {
        clearTimeout(id);
    }),
    setInterval: vi.fn((callback: Function, delay: number) => {
        return setInterval(callback, delay);
    }),
    clearInterval: vi.fn((id: NodeJS.Timeout) => {
        clearInterval(id);
    }),
};

/**
 * Утилита для создания мока функции с типизацией
 */
export function createMockFunction<T extends (...args: any[]) => any>(
    returnValue?: ReturnType<T>
): T & { mock: any } {
    return vi.fn(() => returnValue) as unknown as T & { mock: any };
}

/**
 * Мок для Date для контроля времени в тестах
 */
export function mockDate(date: Date | string | number) {
    const mockedDate = new Date(date);
    vi.spyOn(global, "Date").mockImplementation(() => mockedDate);
    return mockedDate;
}

/**
 * Сброс всех моков
 */
export function resetAllMocks() {
    vi.clearAllMocks();
    vi.restoreAllMocks();
}
