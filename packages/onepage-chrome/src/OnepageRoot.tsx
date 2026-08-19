import * as React from "react";

export interface OnepageRootProps {
  /** Page content. Every other component in this library belongs inside a root. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The page shell that carries the design language: near-black ground, bone
 * text, monospace type, wide tracking and uppercase.
 *
 * Every other component in this library must render inside a `OnepageRoot` —
 * the colour, type and tracking all come from here, so a component mounted
 * outside one falls back to browser defaults.
 */
export function OnepageRoot({ children, className, style }: OnepageRootProps) {
  return (
    <div className={className ? `op-root ${className}` : "op-root"} style={style}>
      {children}
    </div>
  );
}
