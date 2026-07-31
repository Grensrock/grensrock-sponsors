"use client";

import type { ReactNode } from "react";
import type { Tone } from "@/types";

export default function Tag({ tone = "grey", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={"gr-tag gr-tag-" + tone}>{children}</span>;
}
