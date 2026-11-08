/* ============================================================
   Tab icon, coloured by environment
   ============================================================
   The same wordmark everywhere, but the background says which deployment
   a tab belongs to, so it can be picked out of a row of tabs without
   reading titles:

     production  white   unchanged. Not transparent, because a black
                         wordmark disappears against a dark tab strip.
     preview     orange  the staging band's colour (EnvBanner).
     otherwise   blue    a local `npm run dev`. The local band is a pale
                         grey that reads as white at 16px, so the icon
                         gets a colour of its own.

   VERCEL_ENV rather than the NEXT_PUBLIC_ copy EnvBanner reads: this only
   runs on the server, where Vercel always sets it, with or without the
   "expose System Environment Variables" switch.

   assets/wordmark.png is the former app/icon.png with the white keyed out
   to transparency, so the background can be anything.
   ============================================================ */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const BACKGROUND: Record<string, string> = { production: "#FFFFFF", preview: "#DE8140" };
const LOCAL = "#4A90C4";

export default async function Icon() {
  const wordmark = await readFile(join(process.cwd(), "assets/wordmark.png"));
  const background = BACKGROUND[process.env.VERCEL_ENV ?? ""] ?? LOCAL;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background }}>
        <img src={`data:image/png;base64,${wordmark.toString("base64")}`} width={size.width} height={size.height} alt="" />
      </div>
    ),
    size,
  );
}
