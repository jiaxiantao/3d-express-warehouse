import { getAisleWorldZ } from "@/lib/warehouse-layout";

/** A 巷与 B 巷之间的主通道中点 */
const AISLE_WALKWAY_Z = (getAisleWorldZ("A") + getAisleWorldZ("B")) / 2;

export const WAREHOUSE_ROBOT = {
  modelUrl: "/models/robot.glb",
  walkClipName: "Armature|ArmatureAction",
  targetHeight: 1.68,
  spawn: {
    x: 0,
    z: AISLE_WALKWAY_Z,
    /** 初始朝向：沿 +Z 看向 B 巷货架 */
    yaw: 0,
  },
  /**
   * Three.js 相机默认朝 -Z，机身朝 +Z，需补 π 才能与 yaw 对齐。
   * 调试朝向时一般只改 eyeOffset，不要动此项。
   */
  lookYawOffset: Math.PI,
  /**
   * 眼锚点相对颈部骨骼的局部偏移（x 左右，y 高度，z 沿骨骼朝向前方）。
   */
  eyeOffset: { x: 0, y: -0.02, z: -0.12 },
  /**
   * 第三人称追尾机位：随机身朝向跟随，可左右拖拽调整水平环视角度。
   */
  thirdPerson: {
    distance: 6.2,
    height: 3.85,
    /** 默认俯仰（弧度），0 为水平环绕 */
    defaultPitch: 0.32,
    minDistance: 4.5,
    maxDistance: 18,
    orbitYawSensitivity: 0.004,
    orbitPitchSensitivity: 0.003,
    maxOrbitYaw: Math.PI * 0.92,
    minPitch: 0.08,
    maxPitch: Math.PI / 2.1,
  },
  /** 上帝视角：绕仓库中心自由环视，仅在此模式下可拖拽改变视角 */
  godView: {
    targetHeight: 1.2,
    distance: 26,
    defaultYaw: 0.55,
    defaultPitch: 0.72,
    minDistance: 10,
    maxDistance: 42,
    orbitYawSensitivity: 0.004,
    orbitPitchSensitivity: 0.003,
    minPitch: 0.12,
    maxPitch: Math.PI / 2.05,
  },
  /** 第一人称时隐藏机身的渲染层；第三人称需 camera.layers.enable(此值) */
  renderLayer: 1,
  lookSensitivity: 0.0024,
  minPitch: -Math.PI / 2.8,
  maxPitch: Math.PI / 3.2,
  moveSpeed: 2.6,
  /**
   * 起步预热时长（秒）：下达移动指令后，骨骼动画先播放此时长，
   * 之后机器人位置才开始位移，避免「滑步」并表现出蓄力起步。
   */
  moveWarmupSeconds: 0,
  arriveDistance: 0.05,
  /** 绕自身竖直轴（Y）转弯的角速度（弧度/秒），恒定速度避免位跳 */
  turnSpeed: 3.4,
  /** 朝向与目标方向误差小于此值（弧度）后才允许前进 */
  turnAlignThreshold: 0.12,
  /**
   * 单帧最大步进时间（秒）。frameloop="demand" 空闲后首帧 delta 可能极大，
   * 不钳制会导致位置瞬间跳跃，这里上限约等于 20fps。
   */
  maxFrameDelta: 0.05,
  /** 骨骼行走动画（AnimationMixer） */
  locomotion: {
    walkTimeScaleMin: 0.9,
    walkTimeScaleMax: 1.65,
    walkFadeIn: 0.18,
    walkFadeOut: 0.28,
    turnLeanAmplitude: 0,
    turnLeanDamp: 0.14,
    /**
     * 循环裁剪相位（0~1，相对片段总时长）：把行走片段裁成只剩迈步主体再循环，
     * 去掉开头「前摇」与结尾「后摇」的静止帧，避免循环回绕时出现动画真空期。
     * walkStartPhase 裁掉开头，walkEndPhase 裁掉结尾。
     */
    walkStartPhase: 0.1,
    walkEndPhase: 0.66,
  },
  /** 机身碰撞半径，用于巷道边界留白 */
  bodyRadius: 0.38,
  /** 贴地后额外下沉（米），正值让脚更贴地 */
  footSinkY: 0,
  /** 贴地时取蒙皮顶点 Y 分位数（排除少量异常低点） */
  footContactPercentile: 0,
} as const;
