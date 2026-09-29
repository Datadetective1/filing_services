"use client";

import { Printer } from "@phosphor-icons/react";
import { opsButton } from "./button-classes";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={opsButton("secondary", "print:hidden")}>
      <Printer size={18} aria-hidden />
      {label}
    </button>
  );
}
