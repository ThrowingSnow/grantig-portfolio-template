import * as React from "react";
import { Hud } from "onepage-chrome";

/** Mid-charge in the holding section — the meter is part-filled. */
export const Charging = () => <Hud phase="hold" value={0.42} />;

/** The page's opening state: the banner beat, meter empty. */
export const Idle = () => <Hud phase="banner" value={0} />;

/** Fully charged, the point where gravity takes over. */
export const FullCharge = () => <Hud phase="gravity" value={1} />;
