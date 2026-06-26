import * as THREE from "three";

import {
  getAisleWorldZ,
  getRackEastEndX,
  getRackHeight,
  getRackWestEndX,
  WAREHOUSE_LAYOUT,
} from "@/lib/warehouse-layout";
import {
  type RackCategoryEnd,
  type RackCategoryPlacement,
  type WarehouseRackCategory,
} from "@/lib/warehouse-rack-category";

const textureCache = new Map<string, THREE.CanvasTexture>();

const LABEL_FACE_OUTSET = 0.03;

export type RackCategoryLabelTransform = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  planeWidth: number;
  planeHeight: number;
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";

  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [text];
}

function drawCategoryLabelCanvas(category: WarehouseRackCategory): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  const padX = 14;
  const padY = 14;
  const titleFont = "700 26px ui-sans-serif, system-ui, sans-serif";
  const bodyFont = "500 17px ui-sans-serif, system-ui, sans-serif";
  const width = 200;

  ctx.font = titleFont;
  const titleLines = wrapText(ctx, category.name, width - padX * 2);
  ctx.font = bodyFont;
  const bodyLines = wrapText(ctx, category.description, width - padX * 2);

  const titleLineHeight = 30;
  const bodyLineHeight = 22;
  const titleBlockHeight = titleLines.length * titleLineHeight;
  const bodyBlockHeight = bodyLines.length * bodyLineHeight + 8;
  const height = padY * 2 + titleBlockHeight + bodyBlockHeight;

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = category.accent;
  ctx.fillRect(0, 0, 6, height);

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.font = titleFont;
  ctx.fillStyle = "#f8fafc";
  titleLines.forEach((line, index) => {
    ctx.fillText(line, padX, padY + titleLineHeight / 2 + index * titleLineHeight);
  });

  ctx.font = bodyFont;
  ctx.fillStyle = "rgba(226, 232, 240, 0.88)";
  const bodyStartY = padY + titleBlockHeight + 8;
  bodyLines.forEach((line, index) => {
    ctx.fillText(line, padX, bodyStartY + bodyLineHeight / 2 + index * bodyLineHeight);
  });

  return canvas;
}

export function getRackCategoryLabelTexture(placement: RackCategoryPlacement): THREE.CanvasTexture {
  const key = placement.category.id;
  const cached = textureCache.get(key);
  if (cached) {
    return cached;
  }

  const canvas = drawCategoryLabelCanvas(placement.category);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

function getTextureAspect(texture: THREE.CanvasTexture): number {
  const image = texture.image as HTMLCanvasElement | undefined;
  if (!image || image.height <= 0) {
    return 0.55;
  }
  return image.width / image.height;
}

const faceNormal = new THREE.Vector3();
const planeNormal = new THREE.Vector3(0, 0, 1);
const faceQuaternion = new THREE.Quaternion();

function getEndFaceX(end: RackCategoryEnd): number {
  if (end === "west") {
    return getRackWestEndX() - LABEL_FACE_OUTSET;
  }
  return getRackEastEndX() + LABEL_FACE_OUTSET;
}

function getEndFaceNormal(end: RackCategoryEnd): THREE.Vector3 {
  return end === "west" ? faceNormal.set(-1, 0, 0) : faceNormal.set(1, 0, 0);
}

/** 贴在货柜排左右端头侧面顶部（西端 / 东端） */
export function getRackCategoryLabelTransform(
  placement: RackCategoryPlacement,
  texture: THREE.CanvasTexture,
): RackCategoryLabelTransform {
  const rackHeight = getRackHeight();
  const aisleZ = getAisleWorldZ(placement.aisle);
  const topY = WAREHOUSE_LAYOUT.groundY + rackHeight;

  getEndFaceNormal(placement.end);
  faceQuaternion.setFromUnitVectors(planeNormal, faceNormal);

  const maxPlaneWidth = WAREHOUSE_LAYOUT.rackDepth * 2 * 0.88;
  const maxPlaneHeight = rackHeight * 0.34;
  let planeHeight = maxPlaneHeight;
  let planeWidth = getTextureAspect(texture) * planeHeight;

  if (planeWidth > maxPlaneWidth) {
    const scale = maxPlaneWidth / planeWidth;
    planeWidth = maxPlaneWidth;
    planeHeight *= scale;
  }

  // 标签顶边与货架顶横梁齐平，略向下留 4cm 避免穿模
  const labelCenterY = topY - planeHeight / 2 - 0.04;

  return {
    position: [getEndFaceX(placement.end), labelCenterY, aisleZ],
    quaternion: [faceQuaternion.x, faceQuaternion.y, faceQuaternion.z, faceQuaternion.w],
    planeWidth,
    planeHeight,
  };
}

export function disposeRackCategoryLabelTextures() {
  textureCache.forEach((texture) => texture.dispose());
  textureCache.clear();
}
