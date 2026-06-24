import { WAREHOUSE_LAYOUT } from "@/lib/warehouse-layout";
import type {
  SlotAction,
  SlotStatus,
  WarehouseSlot,
  WarehouseStats,
} from "@/lib/warehouse-types";

const SAMPLE_PRODUCTS = [
  { sku: "SKU-1001", name: "蓝牙耳机 Pro", unit: "箱" },
  { sku: "SKU-1002", name: "运动水杯 500ml", unit: "箱" },
  { sku: "SKU-1003", name: "USB-C 数据线", unit: "箱" },
  { sku: "SKU-1004", name: "无线鼠标", unit: "箱" },
  { sku: "SKU-1005", name: "手机支架", unit: "箱" },
  { sku: "SKU-1006", name: "收纳盒套装", unit: "箱" },
  { sku: "SKU-1007", name: "便携充电宝", unit: "箱" },
  { sku: "SKU-1008", name: "键盘保护膜", unit: "箱" },
] as const;

function slotId(aisle: string, bay: number, level: number, side: "left" | "right") {
  const sideCode = side === "left" ? "L" : "R";
  return `${aisle}-${String(bay).padStart(2, "0")}-${sideCode}${level}`;
}

function deriveStatus(quantity: number, capacity: number, locked: boolean): SlotStatus {
  if (locked) {
    return "locked";
  }
  if (quantity <= 0) {
    return "empty";
  }
  const ratio = quantity / capacity;
  if (ratio >= 1) {
    return "full";
  }
  if (ratio <= 0.2) {
    return "low";
  }
  return "occupied";
}

/** 固定基准时间，避免 SSR/客户端 hydration 不一致 */
const MOCK_DATA_EPOCH_MS = Date.parse("2024-06-01T08:00:00.000Z");

function createInitialSlots(): WarehouseSlot[] {
  const slots: WarehouseSlot[] = [];
  let productIndex = 0;

  for (const aisle of WAREHOUSE_LAYOUT.aisles) {
    for (let bay = 1; bay <= WAREHOUSE_LAYOUT.baysPerAisle; bay += 1) {
      for (let level = 1; level <= WAREHOUSE_LAYOUT.levelsPerBay; level += 1) {
        for (const side of ["left", "right"] as const) {
          const capacity = 100;
          const seed = aisle.charCodeAt(0) + bay * 7 + level * 13 + (side === "left" ? 0 : 3);
          const locked = seed % 29 === 0;
          const reserved = !locked && seed % 23 === 0;
          const warning = !locked && !reserved && seed % 31 === 0;

          let quantity = 0;
          let sku: string | null = null;
          let productName: string | null = null;
          let status: SlotStatus = "empty";

          if (warning) {
            const product = SAMPLE_PRODUCTS[productIndex % SAMPLE_PRODUCTS.length];
            productIndex += 1;
            quantity = 15;
            sku = product.sku;
            productName = product.name;
            status = "warning";
          } else if (reserved) {
            status = "reserved";
          } else if (locked) {
            const product = SAMPLE_PRODUCTS[productIndex % SAMPLE_PRODUCTS.length];
            productIndex += 1;
            quantity = 40;
            sku = product.sku;
            productName = product.name;
            status = "locked";
          } else if (seed % 4 !== 0) {
            const product = SAMPLE_PRODUCTS[productIndex % SAMPLE_PRODUCTS.length];
            productIndex += 1;
            const fillPattern = (seed * 17) % 100;
            if (fillPattern > 88) {
              quantity = capacity;
              status = "full";
            } else if (fillPattern < 12) {
              quantity = Math.max(8, Math.floor(capacity * 0.15));
              status = "low";
            } else {
              quantity = Math.floor(capacity * (0.35 + (fillPattern % 50) / 100));
              status = "occupied";
            }
            sku = product.sku;
            productName = product.name;
          }

          slots.push({
            id: slotId(aisle, bay, level, side),
            aisle,
            bay,
            level,
            side,
            status,
            sku,
            productName,
            quantity,
            capacity,
            unit: sku ? SAMPLE_PRODUCTS.find((p) => p.sku === sku)?.unit ?? "箱" : "箱",
            lastUpdated: new Date(MOCK_DATA_EPOCH_MS - seed * 86_400_000).toISOString(),
            locked,
          });
        }
      }
    }
  }

  return slots;
}

export function computeWarehouseStats(slots: WarehouseSlot[]): WarehouseStats {
  const totalSlots = slots.length;
  const emptySlots = slots.filter((s) => s.status === "empty").length;
  const lowStockSlots = slots.filter((s) => s.status === "low").length;
  const warningSlots = slots.filter((s) => s.status === "warning").length;
  const occupiedSlots = totalSlots - emptySlots - slots.filter((s) => s.status === "reserved").length;

  return {
    totalSlots,
    occupiedSlots,
    emptySlots,
    lowStockSlots,
    warningSlots,
    utilizationPercent: totalSlots > 0 ? Math.round(((totalSlots - emptySlots) / totalSlots) * 100) : 0,
  };
}

export function createWarehouseState(): WarehouseSlot[] {
  return createInitialSlots();
}

export function applySlotAction(slots: WarehouseSlot[], slotId: string, action: SlotAction): WarehouseSlot[] {
  return slots.map((slot) => {
    if (slot.id !== slotId) {
      return slot;
    }

    const now = new Date().toISOString();

    switch (action) {
      case "restock": {
        if (slot.locked) {
          return slot;
        }
        const nextQty = Math.min(slot.capacity, slot.quantity + Math.ceil(slot.capacity * 0.4));
        return {
          ...slot,
          quantity: nextQty,
          status: deriveStatus(nextQty, slot.capacity, false),
          lastUpdated: now,
        };
      }
      case "clear": {
        if (slot.locked) {
          return slot;
        }
        return {
          ...slot,
          quantity: 0,
          sku: null,
          productName: null,
          status: "empty",
          lastUpdated: now,
        };
      }
      case "toggle-lock": {
        const locked = !slot.locked;
        return {
          ...slot,
          locked,
          status: locked ? "locked" : deriveStatus(slot.quantity, slot.capacity, false),
          lastUpdated: now,
        };
      }
      case "mark-warning": {
        if (slot.locked || slot.status === "empty") {
          return slot;
        }
        return {
          ...slot,
          status: slot.status === "warning" ? deriveStatus(slot.quantity, slot.capacity, false) : "warning",
          lastUpdated: now,
        };
      }
      case "reserve": {
        if (slot.locked) {
          return slot;
        }
        if (slot.status === "reserved") {
          return {
            ...slot,
            status: slot.quantity > 0 ? deriveStatus(slot.quantity, slot.capacity, false) : "empty",
            lastUpdated: now,
          };
        }
        return {
          ...slot,
          quantity: 0,
          sku: null,
          productName: null,
          status: "reserved",
          lastUpdated: now,
        };
      }
      default:
        return slot;
    }
  });
}

export function getSlotById(slots: WarehouseSlot[], id: string | null): WarehouseSlot | null {
  if (!id) {
    return null;
  }
  return slots.find((slot) => slot.id === id) ?? null;
}

export function filterSlots(slots: WarehouseSlot[], filter: SlotStatus | "all"): WarehouseSlot[] {
  if (filter === "all") {
    return slots;
  }
  return slots.filter((slot) => slot.status === filter);
}
