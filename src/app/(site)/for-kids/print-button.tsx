"use client";

import { Printer } from "lucide-react";

/** Prints the page; the print stylesheet in kids.css keeps only the family agreement. */
export function PrintButton() {
  return <button type="button" className="lp-btn lp-btn-primary" onClick={() => window.print()}><Printer />Print the agreement</button>;
}
