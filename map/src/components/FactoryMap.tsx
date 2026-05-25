"use client";

import { useRef, useEffect, useCallback } from "react";
import { ZONES } from "../data/zones";
import { CONTAMINATION_COLORS } from "../types";
import { useMapStore } from "../store/mapStore";

const VB_FULL = "0 0 1050 510";
const PAD = 40;

function ptPos(
  zone: { x: number; y: number; w: number; h: number },
  index: number,
  total: number
) {
  const cols = Math.min(total, 2);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    cx: zone.x + zone.w * 0.3 + col * (zone.w * 0.35),
    cy: zone.y + zone.h * 0.62 + row * 16,
  };
}

function animateViewBox(
  svgEl: SVGSVGElement,
  from: string,
  to: string,
  dur = 360,
  onDone?: (vb: string) => void
) {
  const parse = (s: string) => s.split(" ").map(Number);
  const [x0, y0, w0, h0] = parse(from);
  const [x1, y1, w1, h1] = parse(to);
  const start = performance.now();

  function step(now: number) {
    const p = Math.min((now - start) / dur, 1);
    const e = p < 0.5 ? 2 * p * p : (4 - 2 * p) * p - 1;
    const vb = `${x0 + (x1 - x0) * e} ${y0 + (y1 - y0) * e} ${
      w0 + (w1 - w0) * e
    } ${h0 + (h1 - h0) * e}`;
    svgEl.setAttribute("viewBox", vb);
    if (p < 1) requestAnimationFrame(step);
    else onDone?.(to);
  }
  requestAnimationFrame(step);
}

export default function FactoryMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { zoneColors, selectedZoneId, viewBox, selectZone, setViewBox } =
    useMapStore();

  const handleSelectZone = useCallback(
    (id: string) => {
      if (!svgRef.current) return;
      const z = ZONES.find((z) => z.id === id);
      if (!z) return;
      const targetVb = `${z.x - PAD} ${z.y - PAD} ${z.w + PAD * 2} ${
        z.h + PAD * 2
      }`;
      animateViewBox(svgRef.current, viewBox, targetVb, 360, setViewBox);
      selectZone(id);
    },
    [viewBox, selectZone, setViewBox]
  );

  // Zoom back out when selection is cleared
  useEffect(() => {
    if (!svgRef.current || selectedZoneId !== null) return;
    animateViewBox(svgRef.current, viewBox, VB_FULL, 360, setViewBox);
  }, [selectedZoneId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 overflow-hidden bg-gray-50">
      <svg
        ref={svgRef}
        viewBox={VB_FULL}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {ZONES.map((z) => {
          const level = zoneColors[z.id] ?? z.color;
          const pal = CONTAMINATION_COLORS[level];
          const isSelected = selectedZoneId === z.id;

          return (
            <g
              key={z.id}
              onClick={() => handleSelectZone(z.id)}
              className="cursor-pointer"
              style={{ opacity: selectedZoneId && !isSelected ? 0.7 : 1 }}
            >
              <rect
                x={z.x}
                y={z.y}
                width={z.w}
                height={z.h}
                fill={pal.fill}
                stroke={isSelected ? pal.text : pal.stroke}
                strokeWidth={isSelected ? 2.5 : 1.5}
                rx={4}
                className="transition-opacity duration-150 hover:opacity-80"
              />

              <text
                x={z.x + z.w / 2}
                y={z.y + z.h * 0.28}
                textAnchor="middle"
                fontSize={9}
                fontWeight={500}
                fill={pal.text}
                style={{ pointerEvents: "none" }}
              >
                {z.label}
              </text>

              {z.sub && (
                <text
                  x={z.x + z.w / 2}
                  y={z.y + z.h * 0.28 + 9}
                  textAnchor="middle"
                  fontSize={7}
                  fill={pal.stroke}
                  style={{ pointerEvents: "none" }}
                >
                  {z.sub}
                </text>
              )}

              {z.pointIds.map((ptId, i) => {
                const pos = ptPos(z, i, z.pointIds.length);
                return (
                  <g key={ptId}>
                    <circle
                      cx={pos.cx}
                      cy={pos.cy}
                      r={4}
                      fill="#E24B4A"
                      style={{ pointerEvents: "none" }}
                    />
                    <text
                      x={pos.cx + 5}
                      y={pos.cy + 3}
                      fontSize={6}
                      fill="#c0392b"
                      fontWeight={500}
                      style={{ pointerEvents: "none" }}
                    >
                      {ptId}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
