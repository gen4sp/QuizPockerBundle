/**
 * Common types shared across different modules
 */

export interface Question {
    text: string;
    answer: number;
    category?: string;
    /** Сложность (1-5) */
    difficulty?: number;
    correctAnswer: number;
}

export interface Deal {
    /** Уникальный ID вопроса */
    id: string;
    /** Подсказка (показывается во второй фазе) */
    hints: Question[];
    /** Правильный ответ */
    correctAnswer: number;
    /** Дополнительные данные */
    metadata?: Record<string, any>;
}

export interface User {
    id: string;
    name: string;
}
