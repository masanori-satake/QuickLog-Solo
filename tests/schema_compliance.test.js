import { validateCategorySchema, validateHistorySchema, validateSettingsSchema } from '../shared/js/schema.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';

const ajv = new Ajv();

const categorySchema = JSON.parse(readFileSync(join(process.cwd(), 'docs/schema/category.schema.json'), 'utf8'));
const historySchema = JSON.parse(readFileSync(join(process.cwd(), 'docs/schema/history.schema.json'), 'utf8'));
const settingsSchema = JSON.parse(readFileSync(join(process.cwd(), 'docs/schema/settings.schema.json'), 'utf8'));

const ajvValidateCategory = ajv.compile(categorySchema);
const ajvValidateHistory = ajv.compile(historySchema);
const ajvValidateSettings = ajv.compile(settingsSchema);

describe('Schema Compliance Tests', () => {

    describe('Category Schema Compliance', () => {
        test('should validate a correct category entry', () => {
            const data = {
                kind: 'QuickLogSolo/Category',
                version: '1.0',
                type: 'category',
                name: 'Test Category',
                color: 'primary'
            };
            expect(validateCategorySchema(data)).toBe(true);
            expect(ajvValidateCategory(data)).toBe(true);
        });

        test('should validate a correct page-break entry', () => {
            const data = {
                kind: 'QuickLogSolo/Category',
                version: '1.0',
                type: 'page-break'
            };
            expect(validateCategorySchema(data)).toBe(true);
            expect(ajvValidateCategory(data)).toBe(true);
        });

        test('should reject category with missing required fields', () => {
            const data = {
                kind: 'QuickLogSolo/Category',
                version: '1.0',
                type: 'category'
                // Missing name and color
            };
            expect(validateCategorySchema(data)).toBe(false);
            expect(ajvValidateCategory(data)).toBe(false);
        });

        test('should reject category with invalid color', () => {
            const data = {
                kind: 'QuickLogSolo/Category',
                version: '1.0',
                type: 'category',
                name: 'Bad Color',
                color: 'not-a-color'
            };
            expect(validateCategorySchema(data)).toBe(false);
            expect(ajvValidateCategory(data)).toBe(false);
        });

        test('should reject page-break with extra fields', () => {
            const data = {
                kind: 'QuickLogSolo/Category',
                version: '1.0',
                type: 'page-break',
                name: 'I should not have a name'
            };
            expect(validateCategorySchema(data)).toBe(false);
            expect(ajvValidateCategory(data)).toBe(false);
        });
    });

    describe('History Schema Compliance', () => {
        test('should validate a correct task entry', () => {
            const data = {
                kind: 'QuickLogSolo/History',
                version: '1.0',
                type: 'task',
                startTime: Date.now(),
                category: 'Dev',
                color: 'teal'
            };
            expect(validateHistorySchema(data)).toBe(true);
            expect(ajvValidateHistory(data)).toBe(true);
        });

        test('should validate a task entry without color (optional in task)', () => {
            const data = {
                kind: 'QuickLogSolo/History',
                version: '1.0',
                type: 'task',
                startTime: Date.now(),
                category: 'Dev'
            };
            expect(validateHistorySchema(data)).toBe(true);
            expect(ajvValidateHistory(data)).toBe(true);
        });

        test('should validate a correct idle entry', () => {
            const data = {
                kind: 'QuickLogSolo/History',
                version: '1.0',
                type: 'idle',
                startTime: Date.now()
            };
            expect(validateHistorySchema(data)).toBe(true);
            expect(ajvValidateHistory(data)).toBe(true);
        });

        test('should validate a correct stop entry', () => {
            const data = {
                kind: 'QuickLogSolo/History',
                version: '1.0',
                type: 'stop',
                startTime: Date.now(),
                endTime: Date.now() + 1000,
                isManualStop: true
            };
            expect(validateHistorySchema(data)).toBe(true);
            expect(ajvValidateHistory(data)).toBe(true);
        });

        test('should reject task without category', () => {
            const data = {
                kind: 'QuickLogSolo/History',
                version: '1.0',
                type: 'task',
                startTime: Date.now()
            };
            expect(validateHistorySchema(data)).toBe(false);
            expect(ajvValidateHistory(data)).toBe(false);
        });

        test('should reject stop without isManualStop', () => {
            const data = {
                kind: 'QuickLogSolo/History',
                version: '1.0',
                type: 'stop',
                startTime: Date.now(),
                endTime: Date.now() + 1000
            };
            expect(validateHistorySchema(data)).toBe(false);
            expect(ajvValidateHistory(data)).toBe(false);
        });
    });

    describe('Settings Schema Compliance', () => {
        test('should validate correct settings object', () => {
            const data = {
                app: 'QuickLog-Solo',
                kind: 'QuickLogSolo/Settings',
                version: '1.0',
                entries: [
                    { key: 'theme', value: 'dark' },
                    { key: 'defaultAnimation', value: 'ripple' }
                ]
            };
            expect(validateSettingsSchema(data)).toBe(true);
            expect(ajvValidateSettings(data)).toBe(true);
        });

        test('should reject settings with invalid app name', () => {
            const data = {
                app: 'WrongApp',
                kind: 'QuickLogSolo/Settings',
                version: '1.0',
                entries: []
            };
            expect(validateSettingsSchema(data)).toBe(false);
            expect(ajvValidateSettings(data)).toBe(false);
        });

        test('should reject settings with invalid reportSettings property', () => {
            const data = {
                app: 'QuickLog-Solo',
                kind: 'QuickLogSolo/Settings',
                version: '1.0',
                entries: [
                    {
                        key: 'reportSettings',
                        value: {
                            format: 'invalid-format',
                            emoji: 'keep',
                            endTime: 'show',
                            duration: 'right',
                            adjust: 'none'
                        }
                    }
                ]
            };
            expect(validateSettingsSchema(data)).toBe(false);
            expect(ajvValidateSettings(data)).toBe(false);
        });
    });
});
