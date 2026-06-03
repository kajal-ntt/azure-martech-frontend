/**
 * @jest-environment jsdom
 *
 * Property-based tests for ResizeDialog component.
 * Tests Property 6 from the image-editor-mvp design.
 *
 * Feature: image-editor-mvp
 */

// Feature: image-editor-mvp, Property 6: Lock aspect ratio calculation

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as fc from "fast-check";
import ResizeDialog, { computeLockedHeight, computeLockedWidth } from "../../components/editor/ResizeDialog";
import type { ResizeDialogProps } from "../../components/editor/ResizeDialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(props: Partial<ResizeDialogProps> = {}) {
  const defaults: ResizeDialogProps = {
    isOpen: true,
    currentWidth: 800,
    currentHeight: 600,
    onConfirm: jest.fn(),
    onClose: jest.fn(),
  };
  return render(<ResizeDialog {...defaults} {...props} />);
}

// Arbitrary for valid canvas dimensions (non-zero to avoid division by zero)
const dimensionArb = fc.integer({ min: 100, max: 4000 });
const newWidthArb = fc.integer({ min: 50, max: 4000 });

// ---------------------------------------------------------------------------
// Property 6: Lock Aspect Ratio Calculation
// Validates: Requirements 5.6
// ---------------------------------------------------------------------------

describe("Property 6: Lock Aspect Ratio Calculation", () => {
  // Pure math function tests
  describe("computeLockedHeight pure function", () => {
    it("returns Math.round(W' * H/W) for any (W, H, W')", () => {
      fc.assert(
        fc.property(
          dimensionArb,
          dimensionArb,
          newWidthArb,
          (W, H, Wprime) => {
            const expected = Math.round(Wprime * (H / W));
            const actual = computeLockedHeight(Wprime, W, H);
            return actual === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("returns Math.round(H' * W/H) for computeLockedWidth", () => {
      fc.assert(
        fc.property(
          dimensionArb,
          dimensionArb,
          newWidthArb,
          (W, H, Hprime) => {
            const expected = Math.round(Hprime * (W / H));
            const actual = computeLockedWidth(Hprime, W, H);
            return actual === expected;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // UI integration tests
  describe("ResizeDialog UI with lock enabled", () => {
    it("changing width updates height to Math.round(W' * H/W) when lock is on", () => {
      fc.assert(
        fc.property(
          dimensionArb,
          dimensionArb,
          newWidthArb,
          (W, H, Wprime) => {
            const { unmount } = renderDialog({ currentWidth: W, currentHeight: H });

            // Enable lock aspect ratio
            const lockCheckbox = screen.getByRole("checkbox", { name: /lock aspect ratio/i });
            fireEvent.click(lockCheckbox);

            // Change width
            const widthInput = screen.getByRole("spinbutton", { name: /width/i }) as HTMLInputElement;
            fireEvent.change(widthInput, { target: { value: String(Wprime) } });

            const heightInput = screen.getByRole("spinbutton", { name: /height/i }) as HTMLInputElement;
            const actualHeight = Number(heightInput.value);
            const expectedHeight = Math.round(Wprime * (H / W));

            unmount();
            return actualHeight === expectedHeight;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Additional unit tests
// ---------------------------------------------------------------------------

describe("ResizeDialog rendering", () => {
  it("returns null when isOpen is false", () => {
    const { container } = renderDialog({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it("renders when isOpen is true", () => {
    renderDialog({ isOpen: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("displays current dimensions", () => {
    renderDialog({ currentWidth: 1920, currentHeight: 1080 });
    expect(screen.getByText(/1920 × 1080/)).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = jest.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm with current width and height when Apply is clicked", () => {
    const onConfirm = jest.fn();
    renderDialog({ currentWidth: 800, currentHeight: 600, onConfirm });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onConfirm).toHaveBeenCalledWith(800, 600);
  });

  it("renders all 4 preset buttons", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "1:1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "16:9" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9:16" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4:3" })).toBeInTheDocument();
  });

  it("preset 1:1 sets equal width and height", () => {
    renderDialog({ currentWidth: 800, currentHeight: 600 });
    fireEvent.click(screen.getByRole("button", { name: "1:1" }));
    const widthInput = screen.getByRole("spinbutton", { name: /width/i }) as HTMLInputElement;
    const heightInput = screen.getByRole("spinbutton", { name: /height/i }) as HTMLInputElement;
    expect(Number(widthInput.value)).toBe(Number(heightInput.value));
  });

  it("does not lock height when lock is off and width changes", () => {
    renderDialog({ currentWidth: 800, currentHeight: 600 });
    const widthInput = screen.getByRole("spinbutton", { name: /width/i }) as HTMLInputElement;
    const heightInput = screen.getByRole("spinbutton", { name: /height/i }) as HTMLInputElement;
    fireEvent.change(widthInput, { target: { value: "1000" } });
    // Height should remain 600 (lock is off)
    expect(Number(heightInput.value)).toBe(600);
  });
});
