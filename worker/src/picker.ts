import pickerHtml from './picker.html';

export async function handlePicker(): Promise<Response> {
  return new Response(pickerHtml, {
    status: 200,
    headers: {
      'content-type': 'text/html;charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
