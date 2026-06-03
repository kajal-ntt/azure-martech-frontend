/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as fc from "fast-check";
import TextStylePanel from "../../components/editor/TextStylePanel";
import type { TextStylePanelProps } from "../../components/editor/TextStylePanel";
import type { BrandKit } from "../../components/editor/EditorLayout";
import type { TextStyle } from "../../components/editor/EditorCanvas";

function buildBrandKit(overrides: Partial<BrandKit> = {}): BrandKit {
  return {
    fonts: [],
    primaryColor: null,
    secondaryColor: null,
    accentColor: null,
    ...overrides,
  };
}

function buildStyle(overrides: Partial<TextStyle> = {}): TextStyle {
  return {
    fontFamily: "Arial",
    fontSize: 24,
    fill: "#000000",
    ...overrides,
  };
}

function renderPanel(props: Partial<TextStylePanelProps> = {}) {
  const defaults: TextStylePanelProps = {
    visible: true,
    style: buildStyle(),
    brandKit: null,
    onChange: jest.fn(),
  };

  return render(<TextStylePanel {...defaults} {...props} />);
}

function openFontPicker() {
  const trigger = screen.getByRole("button", { name: /font family/i });
  fireEvent.click(trigger);
  return trigger;
}

const fontNameArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,28}[A-Za-z0-9]$/)
  .filter(value => value.trim().length > 0);

const hexColorArb = fc.stringMatching(/^#[0-9a-f]{6}$/);

describe("TextStylePanel brand fonts", () => {
  it("shows brand kit fonts in the font picker", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ name: fontNameArb }), { minLength: 1, maxLength: 8 }), fonts => {
        const uniqueFonts = fonts.filter(
          (font, index, all) => all.findIndex(item => item.name === font.name) === index,
        );
        const { unmount } = renderPanel({ brandKit: buildBrandKit({ fonts: uniqueFonts }) });

        openFontPicker();
        const optionNames = screen.getAllByRole("option").map(option => option.textContent);
        const result = uniqueFonts.every(font => optionNames.includes(font.name));

        unmount();
        return result;
      }),
      { numRuns: 50 },
    );
  });

  it("calls onChange when a font is selected", () => {
    const onChange = jest.fn();
    renderPanel({
      onChange,
      brandKit: buildBrandKit({ fonts: [{ name: "Brand Sans", weight: 400 }] }),
    });

    openFontPicker();
    fireEvent.click(screen.getByRole("option", { name: "Brand Sans" }));

    expect(onChange).toHaveBeenCalledWith({ fontFamily: "Brand Sans" });
  });
});

describe("TextStylePanel brand colors", () => {
  it("renders non-null brand color buttons with data-color values", () => {
    const brandKit = buildBrandKit({
      primaryColor: "#ff0000",
      secondaryColor: null,
      accentColor: "#0000ff",
    });
    renderPanel({ brandKit });

    const buttons = screen.getAllByRole("button").filter(button => button.dataset.color);
    expect(buttons.map(button => button.dataset.color)).toEqual(["#ff0000", "#0000ff"]);
  });

  it("applies a brand color immediately", () => {
    fc.assert(
      fc.property(hexColorArb, color => {
        const onChange = jest.fn();
        const { unmount } = renderPanel({
          onChange,
          brandKit: buildBrandKit({ primaryColor: color }),
        });

        fireEvent.click(screen.getByRole("button", { name: /primary brand color/i }));
        const result = onChange.mock.calls[0]?.[0]?.fill === color;

        unmount();
        return result;
      }),
      { numRuns: 50 },
    );
  });
});

describe("TextStylePanel selected style", () => {
  it("reflects font size and fill from the selected object", () => {
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 200 }), hexColorArb, (fontSize, fill) => {
        const { unmount } = renderPanel({ style: buildStyle({ fontSize, fill }) });

        const sizeInput = screen.getByRole("spinbutton", { name: /font size/i }) as HTMLInputElement;
        const colorInput = document.querySelector("#fill-color-input") as HTMLInputElement;
        const result = Number(sizeInput.value) === fontSize && colorInput.value === fill;

        unmount();
        return result;
      }),
      { numRuns: 50 },
    );
  });

  it("applies font size changes immediately", () => {
    const onChange = jest.fn();
    renderPanel({ onChange });

    fireEvent.change(screen.getByRole("spinbutton", { name: /font size/i }), {
      target: { value: "42" },
    });

    expect(onChange).toHaveBeenCalledWith({ fontSize: 42 });
  });

  it("applies custom color changes immediately", () => {
    const onChange = jest.fn();
    renderPanel({ onChange });

    fireEvent.change(document.querySelector("#fill-color-input") as HTMLInputElement, {
      target: { value: "#a1b2c3" },
    });

    expect(onChange).toHaveBeenCalledWith({ fill: "#a1b2c3" });
  });
});

describe("TextStylePanel visibility", () => {
  it("renders nothing when hidden", () => {
    const { container } = renderPanel({ visible: false });
    expect(container.firstChild).toBeNull();
  });

  it("renders the font picker when visible", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /font family/i })).toBeInTheDocument();
  });

  it("keeps line-height and letter-spacing controls separately labelled", () => {
    renderPanel();
    expect(screen.getByRole("combobox", { name: /line height/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /letter spacing/i })).toBeInTheDocument();
  });
});
