import { validateFile } from "@mailer/core";
export async function extractText(
  file: File,
  onProgress?: (message: string) => void,
) {
  validateFile(file.type, file.size);
  onProgress?.("Reading your document…");
  if (file.type === "text/plain") return (await file.text()).slice(0, 65000);
  if (file.type.includes("wordprocessingml")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const { value } = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    return value.slice(0, 65000);
  }
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const loading = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      useSystemFonts: true,
    });
    const document = await loading.promise;
    const pages: string[] = [];
    try {
      if (document.numPages > 30)
        throw new Error("Use a PDF with 30 pages or fewer.");
      for (let i = 1; i <= document.numPages; i++) {
        const page = await document.getPage(i),
          content = await page.getTextContent();
        let text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        if (text.trim().length < 20) {
          onProgress?.(`Reading scanned page ${i} of ${document.numPages}…`);
          const viewport = page.getViewport({ scale: 1.6 }),
            canvas = window.document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
          const { recognize } = await import("tesseract.js");
          text = (await recognize(canvas, "eng")).data.text;
        }
        pages.push(text);
        page.cleanup();
      }
      return pages.join("\n\n").slice(0, 65000);
    } finally {
      await loading.destroy();
    }
  }
  onProgress?.("Reading text in your screenshot…");
  const { recognize } = await import("tesseract.js");
  return (await recognize(file, "eng")).data.text.slice(0, 65000);
}
