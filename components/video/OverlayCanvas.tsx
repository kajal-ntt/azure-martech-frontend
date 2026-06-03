"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect, Circle, Transformer, Group, Path as KonvaPath } from "react-konva";
import type Konva from "konva";
import {
  Overlay,
  LogoOverlay,
  ImageOverlay,
  TextOverlay,
  ShapeOverlay,
  OverlayAnimation,
  OverlayCanvasProps,
} from "@/components/video/VideoOverlayEditor";

// ─── Animation engine ─────────────────────────────────────────────────────────

interface AnimContext {
  currentTime: number;
  inPoint: number;
  baseOpacity: number;
  nodeH: number;
  stageW: number;
  stageH: number;
}

/**
 * Computes animated transform values for a Konva node based on the overlay's
 * animation config and the current playback time.
 *
 * Returns { opacity, scaleX, scaleY, offsetX, offsetY, rotation } deltas
 * that should be applied ON TOP of the overlay's base values.
 */
function computeAnimProps(
  anim: OverlayAnimation | undefined,
  {
    currentTime,
    inPoint,
    baseOpacity,
    nodeH,
    stageW,
    stageH,
  }: AnimContext,
): {
  opacity: number;
  scaleX: number;
  scaleY: number;
  x: number | null;   // null = use overlay.x
  y: number | null;
  rotation: number;
} {
  const defaults = { opacity: baseOpacity, scaleX: 1, scaleY: 1, x: null, y: null, rotation: 0 };
  if (!anim) return defaults;

  const elapsed = Math.max(0, currentTime - inPoint);
  const speed = anim.loopSpeed ?? 1;
  const t = elapsed * speed; // time in seconds, speed-adjusted

  // ── Entrance animation ────────────────────────────────────────────────────
  const entrDur = anim.entranceDuration ?? 0.5;
  const entrProgress = Math.min(1, elapsed / entrDur); // 0→1 over entranceDuration
  const eased = entrProgress < 1 ? easeOutCubic(entrProgress) : 1;

  let entrOpacity = baseOpacity;
  let entrScaleX = 1;
  let entrScaleY = 1;
  let entrX: number | null = null;
  let entrY: number | null = null;

  if (entrProgress < 1) {
    switch (anim.entrance) {
      case "fade-in":
        entrOpacity = baseOpacity * eased;
        break;
      case "zoom-in":
        entrScaleX = 0.1 + 0.9 * eased;
        entrScaleY = 0.1 + 0.9 * eased;
        entrOpacity = baseOpacity * eased;
        break;
      case "zoom-out":
        entrScaleX = 2 - eased;
        entrScaleY = 2 - eased;
        entrOpacity = baseOpacity * eased;
        break;
      case "slide-up":
        entrY = nodeH * (1 - eased);
        entrOpacity = baseOpacity * eased;
        break;
      case "slide-down":
        entrY = -nodeH * (1 - eased);
        entrOpacity = baseOpacity * eased;
        break;
      case "slide-left":
        entrX = stageW * (1 - eased);
        entrOpacity = baseOpacity * eased;
        break;
      case "slide-right":
        entrX = -stageW * (1 - eased);
        entrOpacity = baseOpacity * eased;
        break;
      case "bounce-in": {
        const b = easeOutBounce(entrProgress);
        entrScaleX = b;
        entrScaleY = b;
        entrOpacity = baseOpacity * Math.min(1, entrProgress * 3);
        break;
      }
      case "flip-in":
        entrScaleX = Math.abs(Math.cos(entrProgress * Math.PI));
        entrOpacity = baseOpacity * eased;
        break;
    }
  }

  // ── Loop animation ────────────────────────────────────────────────────────
  let loopScaleX = 1;
  let loopScaleY = 1;
  let loopRotation = 0;
  let loopX: number | null = null;
  let loopY: number | null = null;
  let loopOpacity = entrOpacity;

  switch (anim.loop) {
    case "spin":
      loopRotation = (t * 60) % 360; // 60°/s
      break;
    case "pulse": {
      const pulse = 1 + 0.12 * Math.sin(t * Math.PI * 2);
      loopScaleX = pulse;
      loopScaleY = pulse;
      break;
    }
    case "float":
      loopY = Math.sin(t * Math.PI) * 12;
      break;
    case "shake":
      loopX = Math.sin(t * Math.PI * 8) * 6;
      break;
    case "bounce":
      loopY = Math.abs(Math.sin(t * Math.PI * 1.5)) * -20;
      break;
    case "swing":
      loopRotation = Math.sin(t * Math.PI * 1.2) * 15;
      break;
    case "blink":
      loopOpacity = Math.sin(t * Math.PI * 2) > 0 ? entrOpacity : 0;
      break;
  }

  return {
    opacity: loopOpacity,
    scaleX: entrScaleX * loopScaleX,
    scaleY: entrScaleY * loopScaleY,
    x: entrX ?? loopX,
    y: entrY ?? loopY,
    rotation: loopRotation,
  };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBounce(t: number): number {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) {
    const shifted = t - 1.5 / d1;
    return n1 * shifted * shifted + 0.75;
  }
  if (t < 2.5 / d1) {
    const shifted = t - 2.25 / d1;
    return n1 * shifted * shifted + 0.9375;
  }
  const shifted = t - 2.625 / d1;
  return n1 * shifted * shifted + 0.984375;
}

/**
 * Hook that drives a Konva node's animated properties via rAF.
 *
 * For library shapes (KonvaPath with scaleX = width/100), the hook must NOT
 * reset scaleX/scaleY — those encode the shape's size. The `isLibraryShape`
 * flag tells the hook to leave scale alone.
 */
function useAnimatedNode(
  overlay: Overlay,
  currentTime: number,
  stageW: number,
  stageH: number,
  isLibraryShape = false,
) {
  const nodeRef = useRef<Konva.Node | null>(null);
  const rafRef = useRef<number>(0);
  const currentTimeRef = useRef(currentTime);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const anim = overlay.animation;
    const baseOpacity = overlay.opacity ?? 1;
    const inPoint = overlay.timeline.inPoint;

    // No animation — sync opacity/position only; never touch scale for library shapes
    if (!anim || (anim.entrance === "none" && anim.loop === "none")) {
      node.opacity(baseOpacity);
      if (!isLibraryShape) {
        node.scaleX(1);
        node.scaleY(1);
      }
      node.rotation(0);
      node.x(overlay.x);
      node.y(overlay.y);
      node.getLayer()?.batchDraw();
      return;
    }

    const logicalW = (overlay as any).width ?? 100;
    const logicalH = (overlay as any).height ?? 100;

    // For library shapes, capture the base scale (width/100) so animation multiplies on top
    const baseScaleX = isLibraryShape ? logicalW / 100 : 1;
    const baseScaleY = isLibraryShape ? logicalH / 100 : 1;

    const tick = () => {
      if (!nodeRef.current) return;
      const ct = currentTimeRef.current;
      const props = computeAnimProps(anim, {
        currentTime: ct,
        inPoint,
        baseOpacity,
        nodeH: logicalH,
        stageW,
        stageH,
      });

      node.opacity(props.opacity);
      node.scaleX(baseScaleX * props.scaleX);
      node.scaleY(baseScaleY * props.scaleY);
      node.rotation(props.rotation);

      node.x(overlay.x + (props.x ?? 0));
      node.y(overlay.y + (props.y ?? 0));

      node.getLayer()?.batchDraw();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [overlay, stageW, stageH, isLibraryShape]);

  return nodeRef;
}

export default function OverlayCanvas({
  overlays,
  selectedId,
  currentTime,
  stageWidth,
  stageHeight,
  onSelect,
  onUpdate,
}: Readonly<OverlayCanvasProps>) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  // Keep a stable ref to overlays so onTransformEnd always reads the latest values
  const overlaysRef = useRef(overlays);
  useEffect(() => { overlaysRef.current = overlays; }, [overlays]);
  // Inline text editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Attach Transformer to the selected node ───────────────────────────────
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    // Don't show transformer while editing text inline
    if (editingId) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    if (selectedId) {
      const node = stage.findOne<Konva.Node>(`#${selectedId}`);
      if (node) {
        transformer.nodes([node]);
        transformer.getLayer()?.batchDraw();
      } else {
        transformer.nodes([]);
      }
    } else {
      transformer.nodes([]);
    }
  }, [selectedId, overlays, editingId]);

  // ── Stage background click → deselect ────────────────────────────────────
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      onSelect(null);
      setEditingId(null);
    }
  };

  // ── Double-click on a text node → open inline textarea ───────────────────
  const handleTextDblClick = useCallback((overlay: TextOverlay, node: Konva.Node) => {
    setEditingId(overlay.id);

    const stage = stageRef.current;
    if (!stage) return;

    // Position a native <textarea> exactly over the Konva text node
    const stageBox = stage.container().getBoundingClientRect();
    const absPos = node.getAbsolutePosition();
    const scaleX = node.getAbsoluteScale().x;
    const scaleY = node.getAbsoluteScale().y;

    const textarea = document.createElement("textarea");
    textareaRef.current = textarea;

    Object.assign(textarea.style, {
      position: "fixed",
      top: `${stageBox.top + absPos.y}px`,
      left: `${stageBox.left + absPos.x}px`,
      width: `${Math.max(node.width() * scaleX, 200)}px`,
      minHeight: `${node.height() * scaleY}px`,
      fontSize: `${overlay.fontSize * scaleX}px`,
      fontFamily: overlay.fontFamily,
      fontWeight: overlay.fontWeight,
      fontStyle: overlay.fontStyle,
      color: overlay.fill,
      background: "rgba(0,0,0,0.75)",
      border: "2px solid #4CAF31",
      borderRadius: "4px",
      padding: "4px 6px",
      outline: "none",
      resize: "none",
      lineHeight: String(overlay.lineHeight),
      letterSpacing: `${overlay.letterSpacing}px`,
      zIndex: "9999",
      overflow: "hidden",
      whiteSpace: "pre",
    });

    textarea.value = overlay.text;
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    // Auto-resize height as user types
    const autoResize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    textarea.addEventListener("input", autoResize);

    const commit = () => {
      const newText = textarea.value;
      onUpdate(overlay.id, { text: newText });
      cleanup();
    };

    const cleanup = () => {
      textarea.removeEventListener("input", autoResize);
      textarea.removeEventListener("keydown", onKeyDown);
      textarea.removeEventListener("blur", commit);
      textarea.remove();
      textareaRef.current = null;
      setEditingId(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Commit on Escape or Ctrl/Cmd+Enter
      if (e.key === "Escape") { cleanup(); return; }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { commit(); }
      // Allow regular Enter for newlines — don't commit
    };

    textarea.addEventListener("keydown", onKeyDown);
    textarea.addEventListener("blur", commit);
  }, [onUpdate]);

  // ── Filter overlays to those active at currentTime ────────────────────────
  const visibleOverlays = overlays.filter((o) => {
    if (o.timeline.outPoint === 0) return true;
    return o.timeline.inPoint <= currentTime && currentTime < o.timeline.outPoint;
  });

  return (
    <Stage
      ref={stageRef}
      width={stageWidth || 1}
      height={stageHeight || 1}
      onClick={handleStageClick}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "auto",
      }}
    >
      <Layer
        clipX={0}
        clipY={0}
        clipWidth={stageWidth || 1}
        clipHeight={stageHeight || 1}
      >
        {visibleOverlays.map((overlay) => {
          if (overlay.type === "logo") {
            return (
              <LogoNode
                key={overlay.id}
                overlay={overlay}
                currentTime={currentTime}
                stageWidth={stageWidth}
                stageHeight={stageHeight}
                onSelect={onSelect}
                onUpdate={onUpdate}
              />
            );
          }
          if (overlay.type === "text") {
            return (
              <TextNode
                key={overlay.id}
                overlay={overlay}
                isEditing={editingId === overlay.id}
                currentTime={currentTime}
                stageWidth={stageWidth}
                stageHeight={stageHeight}
                onSelect={onSelect}
                onUpdate={onUpdate}
                onDblClick={handleTextDblClick}
              />
            );
          }
          if (overlay.type === "image") {
            return (
              <ImageNode
                key={overlay.id}
                overlay={overlay}
                currentTime={currentTime}
                stageWidth={stageWidth}
                stageHeight={stageHeight}
                onSelect={onSelect}
                onUpdate={onUpdate}
              />
            );
          }
          if (overlay.type === "shape") {
            return (
              <ShapeNode
                key={overlay.id}
                overlay={overlay}
                currentTime={currentTime}
                stageWidth={stageWidth}
                stageHeight={stageHeight}
                onSelect={onSelect}
                onUpdate={onUpdate}
              />
            );
          }
          return null;
        })}

        {selectedId && (
          <Transformer
            ref={transformerRef}
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox;
              return newBox;
            }}
            onTransformEnd={() => {
              const stage = stageRef.current;
              if (!stage || !selectedId) return;
              const node = stage.findOne<Konva.Node>(`#${selectedId}`);
              if (!node) return;

              const currentOverlay = overlaysRef.current.find(o => o.id === selectedId);
              const isLib = currentOverlay?.type === "shape" && !!(currentOverlay as any).shapeLibraryId;

              let newWidth: number;
              let newHeight: number;

              if (isLib) {
                // Library shapes: scaleX = (oldWidth/100) * transformerDelta
                // So newWidth = node.scaleX() * 100
                newWidth  = Math.max(10, Math.round(Math.abs(node.scaleX()) * 100));
                newHeight = Math.max(10, Math.round(Math.abs(node.scaleY()) * 100));
              } else {
                // Standard nodes: node.width() is the declared size, scaleX is the transformer delta
                newWidth  = Math.max(10, Math.round((node.width()  ?? 100) * Math.abs(node.scaleX())));
                newHeight = Math.max(10, Math.round((node.height() ?? 100) * Math.abs(node.scaleY())));
              }

              const newX = node.x();
              const newY = node.y();

              // Reset scale — overlay width/height now owns the size
              node.scaleX(1);
              node.scaleY(1);
              node.getLayer()?.batchDraw();

              onUpdate(selectedId, {
                width: newWidth,
                height: newHeight,
                x: newX,
                y: newY,
              } as Partial<Overlay>);
            }}
          />
        )}
      </Layer>
    </Stage>
  );
}

// ─── LogoNode ─────────────────────────────────────────────────────────────────

interface LogoNodeProps {
  readonly overlay: LogoOverlay;
  readonly currentTime: number;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly onSelect: (id: string | null) => void;
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
}

function LogoNode({ overlay, currentTime, stageWidth, stageHeight, onSelect, onUpdate }: LogoNodeProps) {
  const nodeRef = useAnimatedNode(overlay, currentTime, stageWidth, stageHeight);
  if (!overlay.konvaImage) return null;
  return (
    <KonvaImage
      ref={nodeRef as any}
      id={overlay.id}
      image={overlay.konvaImage}
      x={overlay.x}
      y={overlay.y}
      width={overlay.width}
      height={overlay.height}
      opacity={overlay.opacity ?? 1}
      draggable
      onClick={() => onSelect(overlay.id)}
      onTap={() => onSelect(overlay.id)}
      onDragEnd={(e) => onUpdate(overlay.id, { x: e.target.x(), y: e.target.y() })}
    />
  );
}

// ─── ImageNode ────────────────────────────────────────────────────────────────

interface ImageNodeProps {
  readonly overlay: ImageOverlay;
  readonly currentTime: number;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly onSelect: (id: string | null) => void;
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
}

function ImageNode({ overlay, currentTime, stageWidth, stageHeight, onSelect, onUpdate }: ImageNodeProps) {
  const nodeRef = useAnimatedNode(overlay, currentTime, stageWidth, stageHeight);
  if (!overlay.konvaImage) return null;

  const imageEl = (
    <KonvaImage
      ref={nodeRef as any}
      id={overlay.id}
      image={overlay.konvaImage}
      x={overlay.x}
      y={overlay.y}
      width={overlay.width}
      height={overlay.height}
      opacity={overlay.opacity}
      scaleX={overlay.flipX ? -1 : 1}
      scaleY={overlay.flipY ? -1 : 1}
      offsetX={overlay.flipX ? overlay.width : 0}
      offsetY={overlay.flipY ? overlay.height : 0}
      cornerRadius={overlay.borderRadius}
      draggable
      perfectDrawEnabled={false}
      onClick={() => onSelect(overlay.id)}
      onTap={() => onSelect(overlay.id)}
      onDragEnd={(e) => onUpdate(overlay.id, { x: e.target.x(), y: e.target.y() })}
    />
  );

  if (!overlay.borderEnabled) return imageEl;

  // When border is enabled, wrap in a Group so the border Rect sits behind.
  // The Group does NOT get the id — the KonvaImage inside does.
  return (
    <Group>
      <Rect
        listening={false}
        x={overlay.x - overlay.borderWidth}
        y={overlay.y - overlay.borderWidth}
        width={overlay.width + overlay.borderWidth * 2}
        height={overlay.height + overlay.borderWidth * 2}
        fill={overlay.borderColor}
        cornerRadius={overlay.borderRadius + overlay.borderWidth}
        perfectDrawEnabled={false}
      />
      {imageEl}
    </Group>
  );
}

// ─── TextNode ─────────────────────────────────────────────────────────────────

interface TextNodeProps {
  readonly overlay: TextOverlay;
  readonly isEditing: boolean;
  readonly currentTime: number;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly onSelect: (id: string | null) => void;
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
  readonly onDblClick: (overlay: TextOverlay, node: Konva.Node) => void;
}

function TextNode({ overlay, isEditing, currentTime, stageWidth, stageHeight, onSelect, onUpdate, onDblClick }: TextNodeProps) {
  const groupRef = useAnimatedNode(overlay, currentTime, stageWidth, stageHeight);
  const textRef = useRef<any>(null);
  const [textDimensions, setTextDimensions] = useState({ width: 0, height: 0 });

  const fontStyle = [
    overlay.fontStyle === "italic" ? "italic" : "",
    overlay.fontWeight === "bold" ? "bold" : "",
  ].filter(Boolean).join(" ") || "normal";

  useEffect(() => {
    if (textRef.current) {
      const w = textRef.current.width();
      const h = textRef.current.height();
      setTextDimensions({ width: w, height: h });
      // Write measured dimensions back so alignment calculations are accurate
      if (w !== overlay.width || h !== overlay.height) {
        onUpdate(overlay.id, { width: w, height: h } as any);
      }
    }
  }, [overlay.text, overlay.fontSize, overlay.fontFamily, overlay.fontWeight, overlay.fontStyle, overlay.lineHeight, overlay.letterSpacing]);

  return (
    <Group
      ref={groupRef as any}
      id={overlay.id}
      x={overlay.x}
      y={overlay.y}
      opacity={isEditing ? 0 : 1}  // hide while native textarea is shown
      draggable={!isEditing}
      onClick={() => onSelect(overlay.id)}
      onTap={() => onSelect(overlay.id)}
      onDblClick={(e) => {
        const node = e.target.getParent() ?? e.target;
        onDblClick(overlay, node);
      }}
      onDragEnd={(e) => onUpdate(overlay.id, { x: e.target.x(), y: e.target.y() })}
    >
      {overlay.highlightEnabled && textDimensions.width > 0 && (
        <Rect
          listening={false}
          fill={overlay.highlightColor}
          x={-overlay.highlightPadding}
          y={-overlay.highlightPadding}
          width={textDimensions.width + overlay.highlightPadding * 2}
          height={textDimensions.height + overlay.highlightPadding * 2}
          cornerRadius={4}
          perfectDrawEnabled={false}
        />
      )}
      {overlay.outlineEnabled && (
        <KonvaText
          listening={false}
          text={overlay.text}
          fontFamily={overlay.fontFamily}
          fontSize={overlay.fontSize}
          fill={overlay.outlineColor}
          fontStyle={fontStyle}
          textDecoration={overlay.underline ? "underline" : ""}
          align={overlay.textAlign}
          lineHeight={overlay.lineHeight}
          letterSpacing={overlay.letterSpacing}
          stroke={overlay.outlineColor}
          strokeWidth={overlay.outlineWidth * 2}
          opacity={overlay.opacity}
          shadowEnabled={false}
          perfectDrawEnabled={false}
        />
      )}
      <KonvaText
        ref={textRef}
        text={overlay.text}
        fontFamily={overlay.fontFamily}
        fontSize={overlay.fontSize}
        fill={overlay.fill}
        fontStyle={fontStyle}
        textDecoration={overlay.underline ? "underline" : ""}
        align={overlay.textAlign}
        opacity={overlay.opacity}
        lineHeight={overlay.lineHeight}
        letterSpacing={overlay.letterSpacing}
        shadowEnabled={overlay.shadowEnabled}
        shadowColor={overlay.shadowColor}
        shadowBlur={overlay.shadowBlur}
        shadowOffsetX={overlay.shadowOffsetX}
        shadowOffsetY={overlay.shadowOffsetY}
        shadowForStrokeEnabled={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

// ─── ShapeNode ────────────────────────────────────────────────────────────────

interface ShapeNodeProps {
  readonly overlay: ShapeOverlay;
  readonly currentTime: number;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly onSelect: (id: string | null) => void;
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
}

function ShapeNode({ overlay, currentTime, stageWidth, stageHeight, onSelect, onUpdate }: ShapeNodeProps) {
  const isLibraryShape = !!(overlay as any).shapeLibraryId;
  const nodeRef = useAnimatedNode(overlay, currentTime, stageWidth, stageHeight, isLibraryShape);

  // Build fill props based on fillType
  const getFillProps = (w: number, h: number) => {
    if (overlay.fillType === "linear") {
      const angle = (overlay.gradientAngle ?? 0) * (Math.PI / 180);
      const cx = w / 2, cy = h / 2;
      const dx = Math.cos(angle) * w / 2;
      const dy = Math.sin(angle) * h / 2;
      return {
        fill: "",                          // clear solid fill
        fillPriority: "linear-gradient" as const,
        fillLinearGradientStartPoint: { x: cx - dx, y: cy - dy },
        fillLinearGradientEndPoint: { x: cx + dx, y: cy + dy },
        fillLinearGradientColorStops: [0, overlay.fill, 1, overlay.gradientEnd ?? "#ffffff"],
      };
    }
    if (overlay.fillType === "radial") {
      const cx = w / 2, cy = h / 2;
      const outerR = Math.max(w, h) / 2;
      const innerR = outerR * (overlay.gradientFocalRadius ?? 0.5);
      return {
        fill: "",                          // clear solid fill
        fillPriority: "radial-gradient" as const,
        fillRadialGradientStartPoint: { x: cx, y: cy },
        fillRadialGradientEndPoint: { x: cx, y: cy },
        fillRadialGradientStartRadius: innerR,
        fillRadialGradientEndRadius: outerR,
        fillRadialGradientColorStops: [0, overlay.fill, 1, overlay.gradientEnd ?? "#ffffff"],
      };
    }
    return { fill: overlay.fill, fillPriority: "color" as const };
  };

  const commonProps = {
    id: overlay.id,
    x: overlay.x,
    y: overlay.y,
    opacity: overlay.opacity,
    stroke: overlay.borderEnabled ? overlay.borderColor : undefined,
    strokeWidth: overlay.borderEnabled ? overlay.borderWidth : 0,
    dash: overlay.borderEnabled && overlay.borderStyle === "dashed" ? [10, 5] : undefined,
    draggable: true,
    onClick: () => onSelect(overlay.id),
    onTap: () => onSelect(overlay.id),
    onDragEnd: (e: any) => onUpdate(overlay.id, { x: e.target.x(), y: e.target.y() }),
  };

  if (overlay.shapeType === "circle") {
    const radius = Math.min(overlay.width, overlay.height) / 2;
    const fillProps = getFillProps(radius * 2, radius * 2);
    return <Circle ref={nodeRef as any} {...commonProps} {...fillProps} radius={radius} offsetX={-radius} offsetY={-radius} />;
  }

  if (overlay.shapeType === "badge") {
    return (
      <Group
        ref={nodeRef as any}
        id={overlay.id}
        x={overlay.x}
        y={overlay.y}
        draggable
        onClick={() => onSelect(overlay.id)}
        onTap={() => onSelect(overlay.id)}
        onDragEnd={(e) => onUpdate(overlay.id, { x: e.target.x(), y: e.target.y() })}
      >
        <Rect
          width={overlay.width}
          height={overlay.height}
          {...getFillProps(overlay.width, overlay.height)}
          opacity={overlay.opacity}
          cornerRadius={overlay.height / 2}
          stroke={overlay.borderEnabled ? overlay.borderColor : undefined}
          strokeWidth={overlay.borderEnabled ? overlay.borderWidth : 0}
        />
        {overlay.badgeText && (
          <KonvaText
            text={overlay.badgeText}
            fontSize={Math.max(10, overlay.height * 0.4)}
            fontFamily="Arial"
            fontStyle="bold"
            fill="#ffffff"
            width={overlay.width}
            height={overlay.height}
            align="center"
            verticalAlign="middle"
          />
        )}
      </Group>
    );
  }

  // For library shapes (shapeLibraryId set), render as SVG path via Konva Path
  // Scale path from 0-0-100-100 viewBox to overlay dimensions using scaleX/scaleY.
  if ((overlay as any).shapeLibraryId) {
    const scaleX = overlay.width / 100;
    const scaleY = overlay.height / 100;
    // Gradient coords in the path's natural 100×100 coordinate space
    const fillProps = getFillProps(100, 100);
    return (
      <KonvaPath
        ref={nodeRef as any}
        id={overlay.id}
        x={overlay.x}
        y={overlay.y}
        data={(overlay as any).shapePath ?? "M0,0 H100 V100 H0 Z"}
        scaleX={scaleX}
        scaleY={scaleY}
        {...fillProps}
        opacity={overlay.opacity}
        stroke={overlay.borderEnabled ? overlay.borderColor : undefined}
        strokeWidth={overlay.borderEnabled ? overlay.borderWidth / Math.max(scaleX, 0.01) : 0}
        draggable
        onClick={() => onSelect(overlay.id)}
        onTap={() => onSelect(overlay.id)}
        onDragEnd={(e: any) => onUpdate(overlay.id, { x: e.target.x(), y: e.target.y() })}
      />
    );
  }

  const fillProps = getFillProps(overlay.width, overlay.height);
  return <Rect ref={nodeRef as any} {...commonProps} {...fillProps} width={overlay.width} height={overlay.height} cornerRadius={overlay.cornerRadius} />;
}
