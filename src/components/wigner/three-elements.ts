/**
 * three.js elements are not DOM nodes, so any `data-*` attribute injected into
 * JSX by dev tooling makes react-three-fiber throw
 * `Cannot set "data-tsd-source"`. These thin wrappers strip `data-*` props
 * before they reach the three.js object.
 */
import { Html as DreiHtml, OrbitControls as DreiOrbitControls } from "@react-three/drei";
import { createElement, forwardRef } from "react";
import type { ComponentType } from "react";

function strip(props: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key in props) {
    if (!key.startsWith("data-")) out[key] = props[key];
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrap<P extends Record<string, any>>(tag: string | ComponentType<P>) {
  const Wrapped = forwardRef<unknown, P>((props, ref) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(tag as any, { ...strip(props), ref } as any),
  );
  Wrapped.displayName = typeof tag === "string" ? tag : "wrapped";
  return Wrapped as unknown as ComponentType<P>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Group = wrap<any>("group");
export const Mesh = wrap<any>("mesh");
export const MeshStandardMaterial = wrap<any>("meshStandardMaterial");
export const LineSegments = wrap<any>("lineSegments");
export const LineBasicMaterial = wrap<any>("lineBasicMaterial");
export const SceneColor = wrap<any>("color");
export const AmbientLight = wrap<any>("ambientLight");
export const HemisphereLight = wrap<any>("hemisphereLight");
export const DirectionalLight = wrap<any>("directionalLight");
export const Html = wrap<any>(DreiHtml as any);
export const OrbitControls = wrap<any>(DreiOrbitControls as any);
