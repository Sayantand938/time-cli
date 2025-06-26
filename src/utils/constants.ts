// src/utils/constants.ts

export interface TimeSlot {
  key: string; // A unique programmatic key, e.g., 'S08_09'
  dbColumn: string; // Database column name, e.g., 's08_09_min'
  storeValue: string; // Value used for internal logic and Inquirer, e.g., "08:00 - 09:00"
  displayName: string; // User-friendly display name, e.g., "08:00 AM - 09:00 AM"
  startHour24: number; // For filtering and logic, e.g., 8
}

// Define all 16 fixed time slots
export const TIME_SLOTS_CONFIG: ReadonlyArray<TimeSlot> = [
  { key: 'S08_09', dbColumn: 's08_09_min', storeValue: '08:00 - 09:00', displayName: '08:00 AM - 09:00 AM', startHour24: 8 },
  { key: 'S09_10', dbColumn: 's09_10_min', storeValue: '09:00 - 10:00', displayName: '09:00 AM - 10:00 AM', startHour24: 9 },
  { key: 'S10_11', dbColumn: 's10_11_min', storeValue: '10:00 - 11:00', displayName: '10:00 AM - 11:00 AM', startHour24: 10 },
  { key: 'S11_12', dbColumn: 's11_12_min', storeValue: '11:00 - 12:00', displayName: '11:00 AM - 12:00 PM', startHour24: 11 },
  { key: 'S12_13', dbColumn: 's12_13_min', storeValue: '12:00 - 13:00', displayName: '12:00 PM - 01:00 PM', startHour24: 12 },
  { key: 'S13_14', dbColumn: 's13_14_min', storeValue: '13:00 - 14:00', displayName: '01:00 PM - 02:00 PM', startHour24: 13 },
  { key: 'S14_15', dbColumn: 's14_15_min', storeValue: '14:00 - 15:00', displayName: '02:00 PM - 03:00 PM', startHour24: 14 },
  { key: 'S15_16', dbColumn: 's15_16_min', storeValue: '15:00 - 16:00', displayName: '03:00 PM - 04:00 PM', startHour24: 15 },
  { key: 'S16_17', dbColumn: 's16_17_min', storeValue: '16:00 - 17:00', displayName: '04:00 PM - 05:00 PM', startHour24: 16 },
  { key: 'S17_18', dbColumn: 's17_18_min', storeValue: '17:00 - 18:00', displayName: '05:00 PM - 06:00 PM', startHour24: 17 },
  { key: 'S18_19', dbColumn: 's18_19_min', storeValue: '18:00 - 19:00', displayName: '06:00 PM - 07:00 PM', startHour24: 18 },
  { key: 'S19_20', dbColumn: 's19_20_min', storeValue: '19:00 - 20:00', displayName: '07:00 PM - 08:00 PM', startHour24: 19 },
  { key: 'S20_21', dbColumn: 's20_21_min', storeValue: '20:00 - 21:00', displayName: '08:00 PM - 09:00 PM', startHour24: 20 },
  { key: 'S21_22', dbColumn: 's21_22_min', storeValue: '21:00 - 22:00', displayName: '09:00 PM - 10:00 PM', startHour24: 21 },
  { key: 'S22_23', dbColumn: 's22_23_min', storeValue: '22:00 - 23:00', displayName: '10:00 PM - 11:00 PM', startHour24: 22 },
  { key: 'S23_00', dbColumn: 's23_00_min', storeValue: '23:00 - 00:00', displayName: '11:00 PM - 12:00 AM', startHour24: 23 },
];

// Helper to find a slot configuration by its storeValue
export function getSlotConfigByStoreValue(storeValue: string): TimeSlot | undefined {
  return TIME_SLOTS_CONFIG.find(slot => slot.storeValue === storeValue);
}

// Helper to find a slot configuration by its displayName
export function getSlotConfigByDisplayName(displayName: string): TimeSlot | undefined {
  return TIME_SLOTS_CONFIG.find(slot => slot.displayName === displayName);
}

// Helper to find a slot configuration by its key
export function getSlotConfigByKey(key: string): TimeSlot | undefined {
  return TIME_SLOTS_CONFIG.find(slot => slot.key === key);
}

// General helper to find a slot by any unique identifier (key, storeValue, or displayName)
export function findSlotConfig(identifier: string): TimeSlot | undefined {
  return TIME_SLOTS_CONFIG.find(
    slot => slot.key === identifier || slot.storeValue === identifier || slot.displayName === identifier
  );
}


// Helper to get all DB column names (for summary, or dynamic table creation)
export const ALL_SLOT_DB_COLUMNS: ReadonlyArray<string> = TIME_SLOTS_CONFIG.map(slot => slot.dbColumn);

// Define shifts based on startHour24 for grouping
export const SHIFT_DEFINITIONS = [
  { name: '▶ 8 AM – 12 PM', startHour: 8, endHour: 12 },   // Covers slots starting at 8, 9, 10, 11
  { name: '▶ 12 PM – 4 PM', startHour: 12, endHour: 16 }, // Covers 12, 13, 14, 15
  { name: '▶ 4 PM – 8 PM', startHour: 16, endHour: 20 },  // Covers 16, 17, 18, 19
  { name: '▶ 8 PM – 12 AM', startHour: 20, endHour: 24 }, // Covers 20, 21, 22, 23 (endHour 24 represents up to midnight)
];

// Define the target minutes for a "full" slot, used for banking/redemption logic
export const SLOT_TARGET_MINUTES = 30;