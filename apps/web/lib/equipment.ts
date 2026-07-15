import type { EquipmentCategoryValue } from 'types/equipment';

export const EQUIPMENT_CATEGORIES: EquipmentCategoryValue[] = [
  'LAPTOP',
  'MONITOR',
  'PHONE',
  'PERIPHERAL',
  'FURNITURE',
  'OTHER',
];

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategoryValue, string> =
  {
    LAPTOP: 'Laptop',
    MONITOR: 'Monitor',
    PHONE: 'Phone',
    PERIPHERAL: 'Peripheral',
    FURNITURE: 'Furniture',
    OTHER: 'Other',
  };

export const MAX_EQUIPMENT_QUANTITY = 20;
