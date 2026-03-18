import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    validateCategorySchema, validateHistorySchema, validateSettingsSchema,
    SCHEMA_KIND_CATEGORY, SCHEMA_VERSION_1_0, SCHEMA_TYPE_CATEGORY, SCHEMA_TYPE_PAGE_BREAK,
    SCHEMA_KIND_HISTORY, SCHEMA_TYPE_HISTORY_TASK, SCHEMA_TYPE_HISTORY_IDLE, SCHEMA_TYPE_HISTORY_STOP,
    SCHEMA_KIND_SETTINGS
} from '../shared/js/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ajv = new Ajv();

const categorySchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/schema/category.schema.json'), 'utf8'));
const historySchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/schema/history.schema.json'), 'utf8'));
const settingsSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/schema/settings.schema.json'), 'utf8'));

const validateCategoryStrict = ajv.compile(categorySchema);
const validateHistoryStrict = ajv.compile(historySchema);
const validateSettingsStrict = ajv.compile(settingsSchema);

describe('Schema Compliance Tests', () => {

    describe('Category Schema Compliance', () => {
        const validCategory = {
            kind: SCHEMA_KIND_CATEGORY,
            version: SCHEMA_VERSION_1_0,
            type: SCHEMA_TYPE_CATEGORY,
            name: 'Work',
            color: 'primary',
            tags: ['dev', 'code'],
            animation: 'digital_rain'
        };

        const validPageBreak = {
            kind: SCHEMA_KIND_CATEGORY,
            version: SCHEMA_VERSION_1_0,
            type: SCHEMA_TYPE_PAGE_BREAK
        };

        test('should validate a correct category entry', () => {
            expect(validateCategorySchema(validCategory)).toBe(true);
            expect(validateCategoryStrict(validCategory)).toBe(true);
        });

        test('should validate a correct page-break entry', () => {
            expect(validateCategorySchema(validPageBreak)).toBe(true);
            expect(validateCategoryStrict(validPageBreak)).toBe(true);
        });

        test('should reject category with missing required fields', () => {
            const invalid = { ...validCategory };
            delete invalid.name;
            expect(validateCategorySchema(invalid)).toBe(false);
            expect(validateCategoryStrict(invalid)).toBe(false);
        });

        test('should reject category with invalid color', () => {
            const invalid = { ...validCategory, color: 'invalid-color' };
            expect(validateCategorySchema(invalid)).toBe(false);
            expect(validateCategoryStrict(invalid)).toBe(false);
        });

        test('should reject page-break with extra fields', () => {
            const invalid = { ...validPageBreak, name: 'Illegal Name' };
            expect(validateCategorySchema(invalid)).toBe(false);
            expect(validateCategoryStrict(invalid)).toBe(false);
        });
    });

    describe('History Schema Compliance', () => {
        const validTask = {
            kind: SCHEMA_KIND_HISTORY,
            version: SCHEMA_VERSION_1_0,
            type: SCHEMA_TYPE_HISTORY_TASK,
            startTime: 1000000,
            endTime: 2000000,
            category: 'Coding',
            color: 'primary',
            tags: ['feat'],
            memo: 'Working on schema'
        };

        const validIdle = {
            kind: SCHEMA_KIND_HISTORY,
            version: SCHEMA_VERSION_1_0,
            type: SCHEMA_TYPE_HISTORY_IDLE,
            startTime: 2000000,
            resumableCategory: 'Coding'
        };

        const validStop = {
            kind: SCHEMA_KIND_HISTORY,
            version: SCHEMA_VERSION_1_0,
            type: SCHEMA_TYPE_HISTORY_STOP,
            startTime: 3000000,
            endTime: 3000000,
            isManualStop: true
        };

        test('should validate a correct task entry', () => {
            expect(validateHistorySchema(validTask)).toBe(true);
            expect(validateHistoryStrict(validTask)).toBe(true);
        });

        test('should validate a correct idle entry', () => {
            expect(validateHistorySchema(validIdle)).toBe(true);
            expect(validateHistoryStrict(validIdle)).toBe(true);
        });

        test('should validate a correct stop entry', () => {
            expect(validateHistorySchema(validStop)).toBe(true);
            expect(validateHistoryStrict(validStop)).toBe(true);
        });

        test('should reject task without category', () => {
            const invalid = { ...validTask };
            delete invalid.category;
            expect(validateHistorySchema(invalid)).toBe(false);
            expect(validateHistoryStrict(invalid)).toBe(false);
        });

        test('should reject stop without isManualStop', () => {
            const invalid = { ...validStop };
            delete invalid.isManualStop;
            expect(validateHistorySchema(invalid)).toBe(false);
            expect(validateHistoryStrict(invalid)).toBe(false);
        });
    });

    describe('Settings Schema Compliance', () => {
        const validSettings = {
            app: 'QuickLog-Solo',
            kind: SCHEMA_KIND_SETTINGS,
            version: SCHEMA_VERSION_1_0,
            entries: [
                { key: 'theme', value: 'dark' },
                { key: 'language', value: 'ja' },
                {
                    key: 'reportSettings',
                    value: {
                        format: 'markdown',
                        emoji: 'keep',
                        endTime: 'show',
                        duration: 'right',
                        adjust: '5'
                    }
                }
            ]
        };

        test('should validate correct settings object', () => {
            expect(validateSettingsSchema(validSettings)).toBe(true);
            expect(validateSettingsStrict(validSettings)).toBe(true);
        });

        test('should reject settings with invalid app name', () => {
            const invalid = { ...validSettings, app: 'WrongApp' };
            expect(validateSettingsSchema(invalid)).toBe(false);
            expect(validateSettingsStrict(invalid)).toBe(false);
        });

        test('should reject settings with invalid reportSettings property', () => {
            const invalid = JSON.parse(JSON.stringify(validSettings));
            invalid.entries[2].value.format = 'invalid-format';
            expect(validateSettingsSchema(invalid)).toBe(false);
            expect(validateSettingsStrict(invalid)).toBe(false);
        });
    });
});
