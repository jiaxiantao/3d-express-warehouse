import {
  WAREHOUSE_LAYOUT,
  type WarehouseAisle,
  getAisleIndex,
} from "@/lib/warehouse-layout";

export type WarehouseRackCategory = {
  id: string;
  name: string;
  description: string;
  accent: string;
};

export type CategoryProduct = {
  sku: string;
  name: string;
  unit: string;
};

/** 三列货柜对应的商品分类（按巷道 A / B / C 对应） */
export const WAREHOUSE_RACK_CATEGORIES: readonly WarehouseRackCategory[] = [
  {
    id: "food-beverage",
    name: "食品饮料类",
    description: "零食、饮料、粮油、生鲜等",
    accent: "#4ade80",
  },
  {
    id: "apparel-general",
    name: "服饰百货类",
    description: "服装、鞋帽、日用百货等",
    accent: "#f472b6",
  },
  {
    id: "furniture-digital",
    name: "家具数码类",
    description: "家具、家电、数码产品等",
    accent: "#38bdf8",
  },
] as const;

/** 各分类下的模拟 SKU（货位数据按巷道分类取用） */
export const WAREHOUSE_CATEGORY_PRODUCTS: Record<
  (typeof WAREHOUSE_RACK_CATEGORIES)[number]["id"],
  readonly CategoryProduct[]
> = {
  "food-beverage": [
    { sku: "FB-1001", name: "矿泉水 550ml×24", unit: "箱" },
    { sku: "FB-1002", name: "红烧牛肉面 12桶", unit: "箱" },
    { sku: "FB-1003", name: "东北大米 5kg", unit: "袋" },
    { sku: "FB-1004", name: "压榨花生油 5L", unit: "桶" },
    { sku: "FB-1005", name: "纯牛奶 250ml×12", unit: "箱" },
    { sku: "FB-1006", name: "薯片 分享装", unit: "箱" },
    { sku: "FB-1007", name: "午餐肉罐头", unit: "箱" },
    { sku: "FB-1008", name: "速冻水饺 1kg", unit: "箱" },
  ],
  "apparel-general": [
    { sku: "AG-2001", name: "纯棉圆领T恤", unit: "件" },
    { sku: "AG-2002", name: "运动短袜 12双", unit: "包" },
    { sku: "AG-2003", name: "洗衣液 3kg", unit: "瓶" },
    { sku: "AG-2004", name: "纯棉毛巾三件套", unit: "套" },
    { sku: "AG-2005", name: "收纳整理箱 大号", unit: "个" },
    { sku: "AG-2006", name: "平板拖把套装", unit: "套" },
    { sku: "AG-2007", name: "抽纸 3层×24包", unit: "箱" },
    { sku: "AG-2008", name: "全棉四件套", unit: "套" },
  ],
  "furniture-digital": [
    { sku: "FD-3001", name: "蓝牙耳机 Pro", unit: "箱" },
    { sku: "FD-3002", name: "USB-C 数据线", unit: "箱" },
    { sku: "FD-3003", name: "无线静音鼠标", unit: "箱" },
    { sku: "FD-3004", name: "便携充电宝 20000mAh", unit: "箱" },
    { sku: "FD-3005", name: "LED 护眼台灯", unit: "箱" },
    { sku: "FD-3006", name: "折叠晾衣架", unit: "套" },
    { sku: "FD-3007", name: "迷你电饭煲 3L", unit: "台" },
    { sku: "FD-3008", name: "机械键盘", unit: "箱" },
  ],
};

/** 货柜端头：西端（左侧面）、东端（右侧面） */
export type RackCategoryEnd = "west" | "east";

export type RackCategoryPlacement = {
  aisle: WarehouseAisle;
  end: RackCategoryEnd;
  category: WarehouseRackCategory;
};

export function getRackCategoryByAisle(aisle: WarehouseAisle): WarehouseRackCategory {
  const aisleIndex = getAisleIndex(aisle);
  return WAREHOUSE_RACK_CATEGORIES[aisleIndex] ?? WAREHOUSE_RACK_CATEGORIES[0]!;
}

export function getProductsForAisle(aisle: WarehouseAisle): readonly CategoryProduct[] {
  const category = getRackCategoryByAisle(aisle);
  return WAREHOUSE_CATEGORY_PRODUCTS[category.id];
}

export function pickProductForAisle(aisle: WarehouseAisle, seed: number): CategoryProduct {
  const products = getProductsForAisle(aisle);
  return products[((seed % products.length) + products.length) % products.length]!;
}

/** 三列货柜 × 左右端头 = 6 张标签 */
export function enumerateRackCategoryPlacements(): RackCategoryPlacement[] {
  const placements: RackCategoryPlacement[] = [];

  for (const aisle of WAREHOUSE_LAYOUT.aisles) {
    const category = getRackCategoryByAisle(aisle);
    for (const end of ["west", "east"] as const) {
      placements.push({ aisle, end, category });
    }
  }

  return placements;
}

export function getRackCategoryPlacementKey(aisle: string, end: RackCategoryEnd): string {
  return `${aisle}-${end}`;
}
