/** 货位占用状态 — 驱动 3D 颜色与面板展示 */
export type SlotStatus =
  | "empty"
  | "occupied"
  | "low"
  | "full"
  | "warning"
  | "reserved"
  | "locked";

export type WarehouseSlot = {
  id: string;
  aisle: string;
  bay: number;
  level: number;
  side: "left" | "right";
  status: SlotStatus;
  sku: string | null;
  productName: string | null;
  quantity: number;
  capacity: number;
  unit: string;
  lastUpdated: string;
  locked: boolean;
};

export type WarehouseStats = {
  totalSlots: number;
  occupiedSlots: number;
  emptySlots: number;
  lowStockSlots: number;
  warningSlots: number;
  utilizationPercent: number;
};

export type WarehouseViewMode = "robot" | "third" | "god";

export type SlotFilter = SlotStatus | "all";

export type SlotAction = "restock" | "clear" | "toggle-lock" | "mark-warning" | "reserve";
