"use client";

import { useRef, useEffect, useState } from "react";
import grapesjs, { Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import newsletterPlugin from "grapesjs-preset-newsletter";

interface EmailEditorPanelProps {
  readonly htmlContent: string;
  readonly onSave: (html: string) => Promise<void>;
  readonly onClose: () => void;
}

export function buildSaveFormData(html: string): FormData {
  const blob = new Blob([html], { type: "text/html" });
  const formData = new FormData();
  formData.append("image", blob, "email-edited.html");
  return formData;
}

export default function EmailEditorPanel({
  htmlContent,
  onSave,
  onClose,
}: EmailEditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      storageManager: false,
      fromElement: false,
      plugins: [newsletterPlugin],
      height: "100%",
      width: "auto",
    });

    editor.setComponents(htmlContent);
    editorRef.current = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [htmlContent]);

  const handleSave = async () => {
    if (!editorRef.current) return;

    // Get both HTML and CSS from GrapesJS
    const html = editorRef.current.getHtml();
    const css = editorRef.current.getCss();
    
    // Combine HTML and CSS into a complete document
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${css}
  </style>
</head>
<body>
${html}
</body>
</html>`;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(fullHtml);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top bar */}
      <div className="h-14 border-b flex items-center justify-between px-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* GrapesJS container */}
      <div ref={containerRef} className="flex-1 overflow-hidden" />

      {/* Error banner */}
      {saveError && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-3 text-red-800">
          {saveError}
        </div>
      )}
    </div>
  );
}
