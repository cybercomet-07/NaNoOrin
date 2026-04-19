/**
 * Build a single self-contained HTML document from a set of generated files by
 * inlining styles.css into a <style> block and script.js into a <script> block.
 *
 * The static-site fast lane produces three files linked by relative paths
 * (`<link href="styles.css">` / `<script src="script.js">`). Those paths resolve
 * to nothing inside an iframe's srcDoc, so we inline them so the preview works.
 */
export function buildInlinedHtml(
  files: Record<string, string>,
): string | null {
  const html = files["index.html"];
  if (!html) return null;
  const css = files["styles.css"] ?? "";
  const js = files["script.js"] ?? "";
  const styleBlock = css ? `<style>\n${css}\n</style>` : "";
  const scriptBlock = js ? `<script>\n${js}\n</script>` : "";

  let out = html;
  out = out.replace(
    /<link[^>]*href=["']styles\.css["'][^>]*>/gi,
    styleBlock,
  );
  out = out.replace(
    /<script[^>]*src=["']script\.js["'][^>]*><\/script>/gi,
    scriptBlock,
  );
  if (styleBlock && !out.includes(styleBlock)) {
    out = out.replace(/<\/head>/i, `${styleBlock}\n</head>`);
  }
  if (scriptBlock && !out.includes(scriptBlock)) {
    out = out.replace(/<\/body>/i, `${scriptBlock}\n</body>`);
  }
  return out;
}
