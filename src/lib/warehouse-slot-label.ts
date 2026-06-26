import * as THREE from "three";

import type { SlotMotionState } from "@/lib/warehouse-animations";
import { FILTER_DIM_OPACITY } from "@/lib/warehouse-colors";
import {
  getSlotAisleFaceNormal,
  getSlotRenderedHalfExtents,
  getSlotWorldPosition,
} from "@/lib/warehouse-layout";
import type { SlotStatus, WarehouseSlot } from "@/lib/warehouse-types";

const textureCache = new Map<string, THREE.CanvasTexture>();

/** 沿巷道方向微微外移，贴在货箱正面外沿（不越过巷道中线） */
const LABEL_FACE_OUTSET = 0.022;

export type SlotLabelTransform = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  planeWidth: number;
  planeHeight: number;
};

function drawLabelCanvas(text: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  const fontSize = 22;
  const font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.font = font;
  const textWidth = ctx.measureText(text).width;
  const padX = 8;
  const padY = 5;
  canvas.width = Math.ceil(textWidth + padX * 2);
  canvas.height = fontSize + padY * 2;

  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  const w = canvas.width;
  const h = canvas.height;
  const radius = 3;

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(w - radius, 0);
  ctx.quadraticCurveTo(w, 0, w, radius);
  ctx.lineTo(w, h - radius);
  ctx.quadraticCurveTo(w, h, w - radius, h);
  ctx.lineTo(radius, h);
  ctx.quadraticCurveTo(0, h, 0, h - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.fillText(text, w / 2, h / 2);

  return canvas;
}

export function formatSlotLabel(slot: WarehouseSlot): string {
  return slot.id;
}

export function getSlotLabelTexture(slot: WarehouseSlot): THREE.CanvasTexture {
  const cached = textureCache.get(slot.id);
  if (cached) {
    return cached;
  }

  const canvas = drawLabelCanvas(formatSlotLabel(slot));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  textureCache.set(slot.id, texture);
  return texture;
}

function getTextureAspect(texture: THREE.CanvasTexture): number {
  const image = texture.image as HTMLCanvasElement | undefined;
  if (!image || image.height <= 0) {
    return 2.2;
  }
  return image.width / image.height;
}

const faceNormal = new THREE.Vector3();
const planeNormal = new THREE.Vector3(0, 0, 1);
const faceQuaternion = new THREE.Quaternion();

/**
 * 每个货位在货架外侧贴一张标签；motion 与货位箱体动画（悬停/补货等）同步。
 */
export function getSlotLabelTransform(
  slot: WarehouseSlot,
  texture: THREE.CanvasTexture,
  motion: SlotMotionState = { scaleMul: 1, shakeX: 0, yLift: 0, interact: 1 },
): SlotLabelTransform {
  const [cx, cy, cz] = getSlotWorldPosition(slot);
  const [nx, ny, nz] = getSlotAisleFaceNormal(slot.side);
  const { halfWidth, halfHeight, halfDepth } = getSlotRenderedHalfExtents();
  const sizeMul = motion.scaleMul * motion.interact;
  const scaledHalfWidth = halfWidth * sizeMul;
  const scaledHalfHeight = halfHeight * sizeMul;
  const scaledHalfDepth = halfDepth * sizeMul;

  faceNormal.set(nx, ny, nz);
  faceQuaternion.setFromUnitVectors(planeNormal, faceNormal);

  const maxPlaneHeight = scaledHalfHeight * 0.34;
  const maxPlaneWidth = scaledHalfWidth * 1.75;
  let planeHeight = Math.min(0.15 * sizeMul, maxPlaneHeight);
  let planeWidth = getTextureAspect(texture) * planeHeight;
  if (planeWidth > maxPlaneWidth) {
    const scale = maxPlaneWidth / planeWidth;
    planeWidth = maxPlaneWidth;
    planeHeight *= scale;
  }

  const outset = LABEL_FACE_OUTSET * sizeMul;
  const faceX = cx + motion.shakeX + nx * scaledHalfDepth;
  const faceY = cy + motion.yLift + ny * scaledHalfDepth;
  const faceZ = cz + nz * scaledHalfDepth;

  return {
    position: [faceX + nx * outset, faceY + ny * outset, faceZ + nz * outset],
    quaternion: [faceQuaternion.x, faceQuaternion.y, faceQuaternion.z, faceQuaternion.w],
    planeWidth,
    planeHeight,
  };
}

export function getSlotLabelOpacity(slot: WarehouseSlot, highlightedFilter: SlotStatus | "all"): number {
  if (highlightedFilter === "all") {
    return 0.96;
  }
  if (slot.status === highlightedFilter) {
    return 1;
  }
  return FILTER_DIM_OPACITY;
}

export function disposeSlotLabelTextures() {
  textureCache.forEach((texture) => texture.dispose());
  textureCache.clear();
}
