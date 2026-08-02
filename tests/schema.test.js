import {
    SCHEMA_VERSION_1_0,
    SCHEMA_VERSION_2_0,
    SCHEMA_KIND_ALARM,
    SCHEMA_KIND_CUSTOM_ANIMATION,
    SCHEMA_KIND_SETTINGS,
    validateAlarmSchema,
    validateCustomAnimationSchema,
    validateSettingsSchema,
} from '../shared/js/schema.js';
import { fc, test as fcTest } from '@fast-check/jest';

describe('Schema v2.0 Constants', () => {
    test('SCHEMA_VERSION_2_0 is "2.0"', () => {
        expect(SCHEMA_VERSION_2_0).toBe('2.0');
    });

    test('SCHEMA_KIND_ALARM is "QuickLogSolo/Alarm"', () => {
        expect(SCHEMA_KIND_ALARM).toBe('QuickLogSolo/Alarm');
    });

    test('SCHEMA_KIND_CUSTOM_ANIMATION is "QuickLogSolo/CustomAnimation"', () => {
        expect(SCHEMA_KIND_CUSTOM_ANIMATION).toBe('QuickLogSolo/CustomAnimation');
    });
});

describe('validateAlarmSchema', () => {
    const validAlarmData = {
        kind: 'QuickLogSolo/Alarm',
        version: '2.0',
        entries: [
            {
                enabled: true,
                time: '23:59',
                message: 'Stop Task',
                action: 'stop',
                actionCategory: '',
                requireConfirmation: false,
                type: 'daily_business',
                daysOfWeek: [1, 2, 3, 4, 5],
                dayOfMonth: 1,
                daysBeforeEnd: 0,
                holidayAdjustment: 'none',
            },
        ],
    };

    test('valid alarm object returns true', () => {
        expect(validateAlarmSchema(validAlarmData)).toBe(true);
    });

    test('empty entries array returns true', () => {
        expect(validateAlarmSchema({ kind: 'QuickLogSolo/Alarm', version: '2.0', entries: [] })).toBe(true);
    });

    test('null data returns false', () => {
        expect(validateAlarmSchema(null)).toBe(false);
    });

    test('non-object data returns false', () => {
        expect(validateAlarmSchema('string')).toBe(false);
    });

    test('wrong kind returns false', () => {
        expect(validateAlarmSchema({ ...validAlarmData, kind: 'Wrong' })).toBe(false);
    });

    test('version "1.0" returns false', () => {
        expect(validateAlarmSchema({ ...validAlarmData, version: '1.0' })).toBe(false);
    });

    test('version null returns false', () => {
        expect(validateAlarmSchema({ ...validAlarmData, version: null })).toBe(false);
    });

    test('version undefined returns false', () => {
        expect(validateAlarmSchema({ ...validAlarmData, version: undefined })).toBe(false);
    });

    test('version empty string returns false', () => {
        expect(validateAlarmSchema({ ...validAlarmData, version: '' })).toBe(false);
    });

    test('version "3.0" returns false', () => {
        expect(validateAlarmSchema({ ...validAlarmData, version: '3.0' })).toBe(false);
    });

    test('missing entries returns false', () => {
        expect(validateAlarmSchema({ kind: 'QuickLogSolo/Alarm', version: '2.0' })).toBe(false);
    });

    test('entries is not an array returns false', () => {
        expect(validateAlarmSchema({ kind: 'QuickLogSolo/Alarm', version: '2.0', entries: {} })).toBe(false);
    });

    test('entry with invalid time returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], time: '25:00' }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with message over 200 chars returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], message: 'a'.repeat(201) }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with invalid action returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], action: 'invalid' }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with actionCategory over 100 chars returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], actionCategory: 'a'.repeat(101) }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with invalid type returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], type: 'invalid_type' }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with daysOfWeek value out of range returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], daysOfWeek: [7] }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with dayOfMonth 0 returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], dayOfMonth: 0 }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with dayOfMonth 32 returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], dayOfMonth: 32 }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with daysBeforeEnd -1 returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], daysBeforeEnd: -1 }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with invalid holidayAdjustment returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], holidayAdjustment: 'invalid' }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with enabled as non-boolean returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], enabled: 'true' }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });

    test('entry with requireConfirmation as non-boolean returns false', () => {
        const data = {
            ...validAlarmData,
            entries: [{ ...validAlarmData.entries[0], requireConfirmation: 1 }],
        };
        expect(validateAlarmSchema(data)).toBe(false);
    });
});

describe('validateCustomAnimationSchema', () => {
    const validAnimationData = {
        kind: 'QuickLogSolo/CustomAnimation',
        version: '2.0',
        entries: [
            {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'My Animation',
                description: 'Custom wave effect',
                config: { exclusionStrategy: 'freedom' },
                renderSpec: { type: 'gif', fps: 30 },
            },
        ],
    };

    test('valid custom animation object returns true', () => {
        expect(validateCustomAnimationSchema(validAnimationData)).toBe(true);
    });

    test('empty entries array returns true', () => {
        expect(
            validateCustomAnimationSchema({ kind: 'QuickLogSolo/CustomAnimation', version: '2.0', entries: [] })
        ).toBe(true);
    });

    test('entry without description returns true', () => {
        const data = {
            ...validAnimationData,
            entries: [
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    name: 'My Animation',
                    config: { exclusionStrategy: 'freedom' },
                    renderSpec: { type: 'gif', fps: 30 },
                },
            ],
        };
        expect(validateCustomAnimationSchema(data)).toBe(true);
    });

    test('null data returns false', () => {
        expect(validateCustomAnimationSchema(null)).toBe(false);
    });

    test('wrong kind returns false', () => {
        expect(validateCustomAnimationSchema({ ...validAnimationData, kind: 'Wrong' })).toBe(false);
    });

    test('version "1.0" returns false', () => {
        expect(validateCustomAnimationSchema({ ...validAnimationData, version: '1.0' })).toBe(false);
    });

    test('version null returns false', () => {
        expect(validateCustomAnimationSchema({ ...validAnimationData, version: null })).toBe(false);
    });

    test('version empty string returns false', () => {
        expect(validateCustomAnimationSchema({ ...validAnimationData, version: '' })).toBe(false);
    });

    test('missing entries returns false', () => {
        expect(validateCustomAnimationSchema({ kind: 'QuickLogSolo/CustomAnimation', version: '2.0' })).toBe(false);
    });

    test('entry with invalid UUID returns false', () => {
        const data = {
            ...validAnimationData,
            entries: [{ ...validAnimationData.entries[0], id: 'not-a-uuid' }],
        };
        expect(validateCustomAnimationSchema(data)).toBe(false);
    });

    test('entry with empty id returns false', () => {
        const data = {
            ...validAnimationData,
            entries: [{ ...validAnimationData.entries[0], id: '' }],
        };
        expect(validateCustomAnimationSchema(data)).toBe(false);
    });

    test('entry with empty name returns false', () => {
        const data = {
            ...validAnimationData,
            entries: [{ ...validAnimationData.entries[0], name: '' }],
        };
        expect(validateCustomAnimationSchema(data)).toBe(false);
    });

    test('entry with name over 100 chars returns false', () => {
        const data = {
            ...validAnimationData,
            entries: [{ ...validAnimationData.entries[0], name: 'a'.repeat(101) }],
        };
        expect(validateCustomAnimationSchema(data)).toBe(false);
    });

    test('entry with description over 500 chars returns false', () => {
        const data = {
            ...validAnimationData,
            entries: [{ ...validAnimationData.entries[0], description: 'a'.repeat(501) }],
        };
        expect(validateCustomAnimationSchema(data)).toBe(false);
    });

    test('entry with null config returns false', () => {
        const data = {
            ...validAnimationData,
            entries: [{ ...validAnimationData.entries[0], config: null }],
        };
        expect(validateCustomAnimationSchema(data)).toBe(false);
    });

    test('entry with array config returns false', () => {
        const data = {
            ...validAnimationData,
            entries: [{ ...validAnimationData.entries[0], config: [] }],
        };
        expect(validateCustomAnimationSchema(data)).toBe(false);
    });

    test('entry with null renderSpec returns false', () => {
        const data = {
            ...validAnimationData,
            entries: [{ ...validAnimationData.entries[0], renderSpec: null }],
        };
        expect(validateCustomAnimationSchema(data)).toBe(false);
    });

    test('entry with array renderSpec returns false', () => {
        const data = {
            ...validAnimationData,
            entries: [{ ...validAnimationData.entries[0], renderSpec: [] }],
        };
        expect(validateCustomAnimationSchema(data)).toBe(false);
    });
});

describe('validateSettingsSchema v2.0 support', () => {
    const validSettingsV1 = {
        app: 'QuickLog-Solo',
        kind: 'QuickLogSolo/Settings',
        version: '1.0',
        entries: [{ key: 'theme', value: 'system' }],
    };

    const validSettingsV2 = {
        app: 'QuickLog-Solo',
        kind: 'QuickLogSolo/Settings',
        version: '2.0',
        entries: [{ key: 'theme', value: 'dark' }],
    };

    test('version "1.0" settings still valid', () => {
        expect(validateSettingsSchema(validSettingsV1)).toBe(true);
    });

    test('version "2.0" settings is valid', () => {
        expect(validateSettingsSchema(validSettingsV2)).toBe(true);
    });

    test('version "3.0" settings is invalid', () => {
        expect(validateSettingsSchema({ ...validSettingsV1, version: '3.0' })).toBe(false);
    });

    test('version null settings is invalid', () => {
        expect(validateSettingsSchema({ ...validSettingsV1, version: null })).toBe(false);
    });

    test('version empty string settings is invalid', () => {
        expect(validateSettingsSchema({ ...validSettingsV1, version: '' })).toBe(false);
    });
});

// =============================================================================
// Property-Based Tests (fast-check)
// Feature: backup-restore-maintenance-overhaul
// Property 4: アラーム・カスタムアニメーションスキーマバリデーションの正確性
// Validates: Requirements 2.2, 2.3, 2.6
// =============================================================================

describe('Property 4: アラーム・カスタムアニメーションスキーマバリデーションの正確性', () => {
    const validEntry = {
        enabled: true,
        time: '23:59',
        message: 'Stop Task',
        action: 'stop',
        actionCategory: '',
        requireConfirmation: false,
        type: 'daily_business',
        daysOfWeek: [1, 2, 3, 4, 5],
        dayOfMonth: 1,
        daysBeforeEnd: 0,
        holidayAdjustment: 'none',
    };

    const validAnimationEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'My Animation',
        description: 'Custom wave effect',
        config: { exclusionStrategy: 'freedom' },
        renderSpec: { type: 'gif', fps: 30 },
    };

    // **Validates: Requirements 2.2, 2.6**
    fcTest.prop([
        fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('3.0'),
            fc.constant('1.0'),
            fc.string().filter((s) => s !== '2.0')
        ),
    ])('validateAlarmSchema rejects invalid versions', (version) => {
        const obj = { kind: 'QuickLogSolo/Alarm', version, entries: [validEntry] };
        expect(validateAlarmSchema(obj)).toBe(false);
    });

    // **Validates: Requirements 2.3, 2.6**
    fcTest.prop([
        fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('3.0'),
            fc.constant('1.0'),
            fc.string().filter((s) => s !== '2.0')
        ),
    ])('validateCustomAnimationSchema rejects invalid versions', (version) => {
        const obj = { kind: 'QuickLogSolo/CustomAnimation', version, entries: [validAnimationEntry] };
        expect(validateCustomAnimationSchema(obj)).toBe(false);
    });
});
