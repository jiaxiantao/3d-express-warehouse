"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  RobotDriveState,
  RobotMoveDirection,
  RobotTurnDirection,
} from "@/lib/warehouse-robot-drive";
import type { WarehouseSceneHandle } from "@/lib/warehouse-scene-types";
import { cn } from "@/lib/utils";

type WarehouseRobotPadProps = {
  sceneHandleRef: React.RefObject<WarehouseSceneHandle | null>;
};

const PAD_BUTTON_BASE =
  "flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-slate-950/75 text-base font-semibold text-slate-100 shadow-lg backdrop-blur-sm transition select-none touch-none";
const PAD_BUTTON_ACTIVE = "scale-95 border-cyan-300/40 bg-slate-900/90 text-cyan-100";

const FORWARD_KEYS = new Set(["ArrowUp", "KeyW"]);
const BACK_KEYS = new Set(["ArrowDown", "KeyS"]);
const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const DRIVE_KEYS = new Set([...FORWARD_KEYS, ...BACK_KEYS, ...LEFT_KEYS, ...RIGHT_KEYS]);

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function has(keys: ReadonlySet<string>, codes: ReadonlySet<string>) {
  for (const code of codes) {
    if (keys.has(code)) {
      return true;
    }
  }
  return false;
}

export function WarehouseRobotPad({ sceneHandleRef }: WarehouseRobotPadProps) {
  const pressedKeys = useRef(new Set<string>());
  const pointerMove = useRef<RobotMoveDirection | null>(null);
  const pointerTurn = useRef<RobotTurnDirection | null>(null);
  const [activeMove, setActiveMove] = useState<RobotMoveDirection | null>(null);
  const [activeTurn, setActiveTurn] = useState<RobotTurnDirection | null>(null);

  const applyControls = useCallback(() => {
    const keys = pressedKeys.current;
    let move: RobotMoveDirection | null = null;
    let turn: RobotTurnDirection | null = null;

    if (has(keys, FORWARD_KEYS)) {
      move = "forward";
    } else if (has(keys, BACK_KEYS)) {
      move = "back";
    }
    if (has(keys, LEFT_KEYS)) {
      turn = "left";
    } else if (has(keys, RIGHT_KEYS)) {
      turn = "right";
    }

    move = pointerMove.current ?? move;
    turn = pointerTurn.current ?? turn;

    setActiveMove(move);
    setActiveTurn(turn);

    const state: RobotDriveState | null = move || turn ? { move, turn } : null;
    sceneHandleRef.current?.setRobotDrive(state);
  }, [sceneHandleRef]);

  const setPointerMove = useCallback(
    (direction: RobotMoveDirection | null) => {
      pointerMove.current = direction;
      applyControls();
    },
    [applyControls],
  );

  const setPointerTurn = useCallback(
    (direction: RobotTurnDirection | null) => {
      pointerTurn.current = direction;
      applyControls();
    },
    [applyControls],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !DRIVE_KEYS.has(event.code)) {
        return;
      }
      // 必须在 repeat 时也阻止默认行为，否则长按方向键会滚动页面
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      pressedKeys.current.add(event.code);
      applyControls();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!DRIVE_KEYS.has(event.code)) {
        return;
      }
      event.preventDefault();
      pressedKeys.current.delete(event.code);
      applyControls();
    };

    const onBlur = () => {
      pressedKeys.current.clear();
      applyControls();
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      pressedKeys.current.clear();
      pointerMove.current = null;
      pointerTurn.current = null;
      setActiveMove(null);
      setActiveTurn(null);
      sceneHandleRef.current?.setRobotDrive(null);
    };
  }, [applyControls, sceneHandleRef]);

  const bindMove = useCallback(
    (direction: RobotMoveDirection) => ({
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setPointerMove(direction);
      },
      onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setPointerMove(null);
      },
      onPointerCancel: () => setPointerMove(null),
      onLostPointerCapture: () => setPointerMove(null),
    }),
    [setPointerMove],
  );

  const bindTurn = useCallback(
    (direction: RobotTurnDirection) => ({
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setPointerTurn(direction);
      },
      onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setPointerTurn(null);
      },
      onPointerCancel: () => setPointerTurn(null),
      onLostPointerCapture: () => setPointerTurn(null),
    }),
    [setPointerTurn],
  );

  return (
    <div
      className="pointer-events-auto grid w-[124px] grid-cols-3 grid-rows-3 gap-1 rounded-2xl border border-white/10 bg-slate-950/50 p-1.5 shadow-xl backdrop-blur-md"
      aria-label="机器人移动与转向控制"
    >
      <div />
      <button
        type="button"
        aria-label="前进（↑ 或 W）"
        aria-pressed={activeMove === "forward"}
        className={cn(PAD_BUTTON_BASE, activeMove === "forward" && PAD_BUTTON_ACTIVE)}
        {...bindMove("forward")}
      >
        ↑
      </button>
      <div />

      <button
        type="button"
        aria-label="左转（← 或 A）"
        aria-pressed={activeTurn === "left"}
        className={cn(PAD_BUTTON_BASE, activeTurn === "left" && PAD_BUTTON_ACTIVE)}
        {...bindTurn("left")}
      >
        ←
      </button>
      <div />
      <button
        type="button"
        aria-label="右转（→ 或 D）"
        aria-pressed={activeTurn === "right"}
        className={cn(PAD_BUTTON_BASE, activeTurn === "right" && PAD_BUTTON_ACTIVE)}
        {...bindTurn("right")}
      >
        →
      </button>

      <div />
      <button
        type="button"
        aria-label="后退（↓ 或 S）"
        aria-pressed={activeMove === "back"}
        className={cn(PAD_BUTTON_BASE, activeMove === "back" && PAD_BUTTON_ACTIVE)}
        {...bindMove("back")}
      >
        ↓
      </button>
      <div />
    </div>
  );
}
