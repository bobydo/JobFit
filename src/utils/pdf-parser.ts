export class PdfParser {
  async extractText(buffer: ArrayBuffer): Promise<string> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/pdf.worker.min.mjs');

    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const pageTexts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pageTexts.push(pageText);
    }
    await doc.destroy();
    return pageTexts.join('\n\n').trim();
  }
}
