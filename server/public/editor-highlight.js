/* Afiche Studio — lightweight HTML/CSS/JS syntax highlighter (no dependencies).
 * Tokenizes line by line with a simple state machine:
 *   text -> tag (<tag attrs>) -> inside <style> => CSS, inside <script> => JS
 * Returns escaped HTML ready to drop into a <pre>.
 */
(function () {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;

  const CSS_PROP = /^(-?[a-zA-Z][a-zA-Z0-9-]*)(\s*:)/;
  const JS_KW = /\b(const|let|var|function|return|if|else|for|while|await|async|new|class|extends|import|export|from|default|try|catch|finally|throw|typeof|instanceof|void|null|undefined|true|false)\b/g;

  function highlightAttr(a) {
    // name="value"  |  name='value'  |  name
    return a
      .replace(/([\w:-]+)(=)("[^"]*"|'[^']*')/g, (_, n, eq, v) => span('at', n) + span('pu', eq) + span('st', v))
      .replace(/^[\w:-]+(?=\s|$)/, m => span('at', m));
  }

  function highlightCss(src) {
    let out = '';
    const re = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|cqw|cqh|s|ms|deg)?\b)|([a-zA-Z-][\w-]*(?=\s*:))|(@[\w-]+)|([{}:;,()])/g;
    let m, last = 0;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += span('cm', m[1]);
      else if (m[2]) out += span('st', m[2]);
      else if (m[3]) out += span('nu', m[3]);
      else if (m[4]) out += span('pr', m[4]);
      else if (m[5]) out += span('kw', m[5]);
      else out += span('pu', m[6]);
      last = m.index + m[0].length;
    }
    return out + esc(src.slice(last));
  }

  function highlightJs(src) {
    let out = '';
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()|([{}()\[\];,.:?]|[=+\-*/%<>!&|]+)/g;
    let m, last = 0;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      let tok = m[0];
      if (m[1]) out += span('cm', m[1]);
      else if (m[2]) out += span('st', m[2]);
      else if (m[3]) out += span('nu', m[3]);
      else if (m[4]) out += span('t', m[4]);
      else out += span('pu', m[5]);
      last = m.index + tok.length;
    }
    out += esc(src.slice(last));
    return out.replace(JS_KW, w => span('kw', w));
  }

  function highlightHtml(src) {
    let out = '', last = 0;
    // Comments and whole tags; the gaps between them are text
    const re = /<!--[\s\S]*?(?:-->|$)|<\/?([a-zA-Z][\w:-]*)((?:\s+[^<>]*?)?)(\/?)>/g;
    let m;
    const inTag = t => /(^|\s)(style|script)$/i.test(t);

    while ((m = re.exec(src))) {
      out += textPart(src.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith('<!--')) {
        out += span('cm', tok);
        last = m.index + tok.length;
        continue;
      }
      const tag = m[1], attrs = m[2] || '', closeSlash = m[3] || '';
      // Opening or closing tag?
      const isClose = tok.startsWith('</');
      let piece = span('pu', isClose ? '</' : '<') + span('t', tag);
      if (!isClose && attrs) {
        // keep the leading whitespace, highlight the rest
        const ws = attrs.match(/^\s*/)[0];
        piece += ws.replace(/\s+/g, w => esc(w)) + highlightAttr(attrs.trim());
        if (closeSlash) piece += span('pu', closeSlash);
      }
      piece += span('pu', isClose ? '>' : '>');
      out += piece;
      last = m.index + tok.length;

      // style/script blocks up to their closing tag
      if (!isClose && inTag(tag)) {
        const closer = new RegExp('</' + tag + '\\s*>', 'i');
        const rest = src.slice(last);
        const found = rest.search(closer);
        const body = found === -1 ? rest : rest.slice(0, found);
        out += /script/i.test(tag) ? highlightJs(body) : highlightCss(body);
        last += body.length;
      }
    }
    out += textPart(src.slice(last));
    return out;
  }

  // Text outside tags: minimal escaping only
  function textPart(s) { return esc(s); }

  window.aficheHighlight = function (src) {
    try { return highlightHtml(src); }
    catch (e) { return esc(src); } // never break the editor over highlighting
  };
})();
