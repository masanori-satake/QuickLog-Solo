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

        test('should reject category with invalid tags array', () => {
            const base = {
                kind: 'QuickLogSolo/Category',
                version: '1.0',
                type: 'category',
                name: 'Test',
                color: 'primary'
            };
            // Non-string tag
            expect(validateCategorySchema({ ...base, tags: [123] })).toBe(false);
            // Too many tags (limit 20)
            expect(validateCategorySchema({ ...base, tags: new Array(21).fill('tag') })).toBe(false);
            // Too long tag (limit 30)
            expect(validateCategorySchema({ ...base, tags: ['a'.repeat(31)] })).toBe(false);
            // Empty string tag
            expect(validateCategorySchema({ ...base, tags: [''] })).toBe(false);
            // Not an array
            expect(validateCategorySchema({ ...base, tags: 'not-an-array' })).toBe(false);
        });

        test('should reject category with too long animation name', () => {
            const data = {
                kind: 'QuickLogSolo/Category',
                version: '1.0',
                type: 'category',
                name: 'Test',
                color: 'primary',
                animation: 'a'.repeat(51)
            };
            expect(validateCategorySchema(data)).toBe(false);
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
                    { key: 'defaultAnimation', value: 'ripple' },
                    { key: 'font', value: 'Arial' },
                    { key: 'language', value: 'ja' }
                ]
            };
            expect(validateSettingsSchema(data)).toBe(true);
            expect(ajvValidateSettings(data)).toBe(true);
        });

        test('should reject invalid values for theme and language', () => {
            const base = {
                app: 'QuickLog-Solo',
                kind: 'QuickLogSolo/Settings',
                version: '1.0'
            };
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'theme', value: 'blue' }] })).toBe(false);
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'language', value: 'jp' }] })).toBe(false);
        });

        test('should reject invalid font or animation length', () => {
            const base = {
                app: 'QuickLog-Solo',
                kind: 'QuickLogSolo/Settings',
                version: '1.0'
            };
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'font', value: 'a'.repeat(201) }] })).toBe(false);
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'defaultAnimation', value: 'a'.repeat(51) }] })).toBe(false);
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

            const base = {
                app: 'QuickLog-Solo',
                kind: 'QuickLogSolo/Settings',
                version: '1.0',
                entries: [{ key: 'reportSettings', value: {} }]
            };
            // Missing required fields
            expect(validateSettingsSchema(base)).toBe(false);
            // Invalid options
            const val = { format: 'csv', emoji: 'maybe', endTime: 'never', duration: 'left', adjust: '7' };
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'reportSettings', value: val }] })).toBe(false);
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

        test('should validate correct alarms entry in settings', () => {
            const data = {
                app: 'QuickLog-Solo',
                kind: 'QuickLogSolo/Settings',
                version: '1.0',
                entries: [
                    {
                        key: 'alarms',
                        value: [
                            {
                                id: 1,
                                enabled: true,
                                time: '09:00',
                                message: 'Good morning',
                                action: 'start',
                                actionCategory: 'Dev',
                                requireConfirmation: true
                            }
                        ]
                    }
                ]
            };
            expect(validateSettingsSchema(data)).toBe(true);
            expect(ajvValidateSettings(data)).toBe(true);
        });

        test('should reject alarms entry with missing requireConfirmation', () => {
            const data = {
                app: 'QuickLog-Solo',
                kind: 'QuickLogSolo/Settings',
                version: '1.0',
                entries: [
                    {
                        key: 'alarms',
                        value: [
                            {
                                id: 1,
                                enabled: true,
                                time: '09:00',
                                message: 'Good morning',
                                action: 'none',
                                actionCategory: ''
                                // missing requireConfirmation
                            }
                        ]
                    }
                ]
            };
            expect(validateSettingsSchema(data)).toBe(false);
            expect(ajvValidateSettings(data)).toBe(false);
        });

        test('should reject invalid alarm properties', () => {
            const baseAlarm = { enabled: true, time: '09:00', message: 'Hi', action: 'none', actionCategory: '', requireConfirmation: false };
            const base = { app: 'QuickLog-Solo', kind: 'QuickLogSolo/Settings', version: '1.0' };

            expect(validateSettingsSchema({ ...base, entries: [{ key: 'alarms', value: [{ ...baseAlarm, enabled: 'yes' }] }] })).toBe(false);
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'alarms', value: [{ ...baseAlarm, time: '9:00' }] }] })).toBe(false);
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'alarms', value: [{ ...baseAlarm, message: 'a'.repeat(201) }] }] })).toBe(false);
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'alarms', value: [{ ...baseAlarm, action: 'jump' }] }] })).toBe(false);
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'alarms', value: [{ ...baseAlarm, actionCategory: 123 }] }] })).toBe(false);
            expect(validateSettingsSchema({ ...base, entries: [{ key: 'alarms', value: [{ ...baseAlarm, requireConfirmation: 'no' }] }] })).toBe(false);
        });
    });

    describe('History Schema Edge Cases', () => {
        const base = { kind: 'QuickLogSolo/History', version: '1.0', startTime: Date.now() };

        test('should reject task with invalid tags or memo', () => {
            const task = { ...base, type: 'task', category: 'Dev' };
            expect(validateHistorySchema({ ...task, tags: [123] })).toBe(false);
            expect(validateHistorySchema({ ...task, tags: new Array(21).fill('t') })).toBe(false);
            expect(validateHistorySchema({ ...task, memo: 'a'.repeat(1001) })).toBe(false);
        });

        test('should reject idle with extra fields', () => {
            const idle = { ...base, type: 'idle' };
            expect(validateHistorySchema({ ...idle, category: 'Dev' })).toBe(false);
            expect(validateHistorySchema({ ...idle, isManualStop: true })).toBe(false);
        });

        test('should reject stop with extra fields', () => {
            const stop = { ...base, type: 'stop', endTime: Date.now() + 1000, isManualStop: true };
            expect(validateHistorySchema({ ...stop, category: 'Dev' })).toBe(false);
            expect(validateHistorySchema({ ...stop, memo: 'memo' })).toBe(false);
        });
    });
});
