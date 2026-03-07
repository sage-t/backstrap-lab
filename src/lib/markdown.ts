function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInline(raw: string): string {
  let text = escapeHtml(raw);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return text;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]?.trim() ?? '';
    if (!line) {
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${formatInline(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? '').trim();
        const match = current.match(/^[-*+]\s+(.*)$/);
        if (!match) break;
        items.push(`<li>${formatInline(match[1].trim())}</li>`);
        i += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? '').trim();
        const match = current.match(/^\d+\.\s+(.*)$/);
        if (!match) break;
        items.push(`<li>${formatInline(match[1].trim())}</li>`);
        i += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const currentRaw = lines[i] ?? '';
      const current = currentRaw.trim();
      if (!current) break;
      if (/^(#{1,6})\s+/.test(current) || /^[-*+]\s+/.test(current) || /^\d+\.\s+/.test(current)) break;
      paragraphLines.push(formatInline(currentRaw));
      i += 1;
    }

    html.push(`<p>${paragraphLines.join('<br>')}</p>`);
  }

  return html.join('\n');
}
