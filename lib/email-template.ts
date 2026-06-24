const emailFont =
  "Aptos, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const styles = {
  h1:
    `margin:0 0 16px;font-family:${emailFont};font-size:22px;line-height:28px;font-weight:700;color:#470b1a;`,
  h2:
    `margin:26px 0 10px;font-family:${emailFont};font-size:17px;line-height:24px;font-weight:700;color:#470b1a;`,
  h3:
    `margin:20px 0 8px;font-family:${emailFont};font-size:14px;line-height:22px;font-weight:700;color:#470b1a;`,
  p:
    `margin:16px 0;font-family:${emailFont};font-size:14px;line-height:22px;font-weight:400;color:#333333;`,
  ul:
    `margin:12px 0 18px 20px;padding:0;font-family:${emailFont};font-size:14px;line-height:22px;color:#333333;`,
  ol:
    `margin:12px 0 18px 20px;padding:0;font-family:${emailFont};font-size:14px;line-height:22px;color:#333333;`,
  li:
    `margin:6px 0;font-family:${emailFont};font-size:14px;line-height:22px;color:#333333;`,
  a:
    `color:#470b1a;text-decoration:underline;text-underline-offset:2px;`,
  blockquote:
    `margin:18px 0;padding:12px 16px;border-left:3px solid #e7dde1;background-color:#faf7f8;font-family:${emailFont};font-size:13px;line-height:20px;color:#555555;`,
  hr: `border:0;border-top:1px solid #e7dde1;margin:24px 0;`,
};

export function buildClientAlertEmailHtml(contentHtml: string): string {
  const bodyHtml = styleArticleHtml(contentHtml);

  return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Client alert</title>
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border-spacing:0;background-color:#ffffff;">
      <tr>
        <td align="center" style="padding:0;background-color:#ffffff;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;border-spacing:0;">
            <tr>
              <td style="padding:32px 24px 40px;font-family:${emailFont};font-size:14px;line-height:22px;color:#333333;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function styleArticleHtml(html: string): string {
  return html
    .replace(/<h1\b([^>]*)>/gi, `<h1$1 style="${styles.h1}">`)
    .replace(/<h2\b([^>]*)>/gi, `<h2$1 style="${styles.h2}">`)
    .replace(/<h3\b([^>]*)>/gi, `<h3$1 style="${styles.h3}">`)
    .replace(/<p\b([^>]*)>/gi, `<p$1 style="${styles.p}">`)
    .replace(/<ul\b([^>]*)>/gi, `<ul$1 style="${styles.ul}">`)
    .replace(/<ol\b([^>]*)>/gi, `<ol$1 style="${styles.ol}">`)
    .replace(/<li\b([^>]*)>/gi, `<li$1 style="${styles.li}">`)
    .replace(/<a\b([^>]*)>/gi, `<a$1 style="${styles.a}">`)
    .replace(/<blockquote\b([^>]*)>/gi, `<blockquote$1 style="${styles.blockquote}">`)
    .replace(/<hr\s*\/?>/gi, `<hr style="${styles.hr}">`);
}
