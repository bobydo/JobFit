import * as pdfjs from 'pdfjs-dist';

let workerConfigured = false;

function configureWorker(): void {
  if (workerConfigured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/pdf.worker.min.mjs');
  workerConfigured = true;
}

export async function extractText(buffer: ArrayBuffer): Promise<string> {
  configureWorker();
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
