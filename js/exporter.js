class HtmlExporter {
    constructor() {
        this.pages = [];
        this.layoutParams = null;
        this.docTitle = '未命名文档';
    }

    setData(pages, layoutParams, docTitle) {
        this.pages = pages;
        this.layoutParams = layoutParams;
        this.docTitle = docTitle || '未命名文档';
    }

    exportToHtml() {
        const html = this._buildHtml();
        this._downloadFile(html);
    }

    _buildHtml() {
        const css = this._buildCss();
        const body = this._buildBody();

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${this._escapeHtml(this.docTitle)}</title>
${css}
</head>
<body>
${body}
</body>
</html>`;
    }

    _buildCss() {
        const params = this.layoutParams;
        const widthMm = params.pageWidthMm;
        const heightMm = params.pageHeightMm;
        const marginTop = params.marginTopMm;
        const marginBottom = params.marginBottomMm;
        const marginLeft = params.marginLeftMm;
        const marginRight = params.marginRightMm;
        const fontSizePt = params.fontSizePt;
        const lineHeight = params.lineHeight;
        const fontFamily = params.fontFamily;
        const headingSizes = {
            1: params.getHeadingFontSize(1),
            2: params.getHeadingFontSize(2),
            3: params.getHeadingFontSize(3)
        };
        const headerFontSize = params.getHeaderFontSize();
        const footerFontSize = params.getFooterFontSize();
        const footnoteFontSize = params.getFootnoteFontSize();

        let pageCss = '';
        this.pages.forEach((page, idx) => {
            pageCss += `
@media print {
    .page-${idx + 1} { page-break-after: always; }
    .page-${idx + 1}:last-child { page-break-after: auto; }
}
@media screen {
    .page-${idx + 1} {
        page-break-after: always;
        margin: 20px auto;
    }
}`;
        });

        return `<style>
@page {
    size: ${widthMm}mm ${heightMm}mm;
    margin: 0;
}

* {
    box-sizing: border-box;
}

html, body {
    margin: 0;
    padding: 0;
    font-family: ${fontFamily};
    font-size: ${fontSizePt}pt;
    line-height: ${lineHeight};
    color: #2d3436;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

@media screen {
    body {
        background: #e8e9ed;
        padding: 20px;
    }
}

.page {
    width: ${widthMm}mm;
    height: ${heightMm}mm;
    background: white;
    position: relative;
    overflow: hidden;
    page-break-inside: avoid;
}

@media screen {
    .page {
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
}

.page-header {
    position: absolute;
    top: 0;
    left: ${marginLeft}mm;
    right: ${marginRight}mm;
    padding: ${Math.max(8, marginTop / 2)}mm ${0}mm ${4}mm;
    font-size: ${headerFontSize}pt;
    color: #95a5a6;
    text-align: center;
    border-bottom: 0.3pt solid #ecf0f1;
}

.page-footer {
    position: absolute;
    bottom: 0;
    left: ${marginLeft}mm;
    right: ${marginRight}mm;
    padding: ${4}mm ${0}mm ${Math.max(8, marginBottom / 2)}mm;
    font-size: ${footerFontSize}pt;
    color: #95a5a6;
    text-align: center;
}

.page-body {
    position: absolute;
    top: ${marginTop}mm;
    left: ${marginLeft}mm;
    right: ${marginRight}mm;
    bottom: ${marginBottom}mm;
    overflow: hidden;
}

.rendered-block {
    position: absolute;
    left: 0;
    right: 0;
}

.rendered-h1,
.rendered-h2,
.rendered-h3 {
    font-weight: 700;
}

.rendered-h1 { font-size: ${headingSizes[1]}pt; line-height: 1.3; }
.rendered-h2 { font-size: ${headingSizes[2]}pt; line-height: 1.3; }
.rendered-h3 { font-size: ${headingSizes[3]}pt; line-height: 1.3; }

.rendered-paragraph,
.rendered-footnote {
    text-align: justify;
    text-justify: inter-ideograph;
}

.rendered-line {
    display: block;
    white-space: pre-wrap;
    word-break: normal;
    overflow: hidden;
}

.rendered-image {
    background: repeating-linear-gradient(
        45deg,
        #f8f9fa,
        #f8f9fa 5mm,
        #e9ecef 5mm,
        #e9ecef 10mm
    );
    border: 1pt dashed #adb5bd;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    color: #6c757d;
    text-align: center;
    padding: 4mm;
    box-sizing: border-box;
}

.rendered-image-caption {
    margin-top: 2mm;
    font-size: ${fontSizePt * 0.85}pt;
    color: #495057;
    text-align: center;
}

.rendered-table {
    border-collapse: collapse;
    width: 100%;
    font-size: ${fontSizePt * 0.9}pt;
}

.rendered-table th,
.rendered-table td {
    border: 0.5pt solid #dee2e6;
    padding: 1mm 1.5mm;
    text-align: left;
    vertical-align: top;
}

.rendered-table th {
    background: #f8f9fa !important;
    font-weight: 600;
}

.footnote-area {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    border-top: 0.3pt solid #95a5a6;
    padding-top: 2mm;
    font-size: ${footnoteFontSize}pt;
    line-height: 1.5;
    color: #495057;
}

.footnote-item {
    margin-bottom: 1mm;
    padding-left: 4mm;
    position: relative;
}

.footnote-item::before {
    content: attr(data-num);
    position: absolute;
    left: 0;
    top: 0;
    font-size: ${footnoteFontSize * 0.85}pt;
    vertical-align: super;
    line-height: 1.5;
}

.footnote-ref {
    font-size: 0.65em;
    vertical-align: super;
    line-height: 0;
    color: #0984e3;
    font-weight: 600;
}

.inline-bold {
    font-weight: 700;
}

.inline-italic {
    font-style: italic;
}

${pageCss}
</style>`;
    }

    _buildBody() {
        let html = '';
        this.pages.forEach((page, pageIdx) => {
            html += `<div class="page page-${pageIdx + 1}">`;

            if (this.layoutParams.showHeader) {
                html += `<div class="page-header">${this._escapeHtml(this.docTitle)}</div>`;
            }

            html += `<div class="page-body">`;

            page.pieces.forEach((piece) => {
                html += this._renderPiece(piece);
            });

            if (page.footnotes.length > 0) {
                html += `<div class="footnote-area" style="top: auto; bottom: 0;">`;
                page.footnotes.forEach(fn => {
                    html += `<div class="footnote-item" data-num="${fn.number}">${this._escapeHtml(fn.text)}</div>`;
                });
                html += `</div>`;
            }

            html += `</div>`;

            if (this.layoutParams.showPageNumber) {
                html += `<div class="page-footer">— ${pageIdx + 1} —</div>`;
            }

            html += `</div>`;
        });

        return html;
    }

    _renderPiece(piece) {
        const topPx = piece.top;
        const heightPx = piece.height;
        const topMm = this._pxToMm(topPx);
        const heightMm = this._pxToMm(heightPx);

        let innerHtml = '';

        switch (piece.type) {
            case window.Types.BlockType.H1:
            case window.Types.BlockType.H2:
            case window.Types.BlockType.H3:
                innerHtml = this._renderHeadingPiece(piece);
                break;
            case window.Types.BlockType.PARAGRAPH:
                innerHtml = this._renderParagraphPiece(piece);
                break;
            case window.Types.BlockType.IMAGE:
                innerHtml = this._renderImagePiece(piece);
                break;
            case window.Types.BlockType.TABLE:
                innerHtml = this._renderTablePiece(piece);
                break;
            case window.Types.BlockType.FOOTNOTE_REF:
                innerHtml = this._renderParagraphPiece(piece);
                break;
        }

        return `<div class="rendered-block rendered-${piece.type}" style="top:${topMm}mm; height:${heightMm}mm;">${innerHtml}</div>`;
    }

    _renderHeadingPiece(piece) {
        const level = piece.data.level;
        const lines = piece.data.lines || [];
        const fontSizePt = this.layoutParams.getHeadingFontSize(level);
        const fontSizePx = ptToPx(fontSizePt);
        const lineHeightPx = fontSizePx * Math.max(1.2, this.layoutParams.lineHeight - 0.2);
        const lineHeightMm = this._pxToMm(lineHeightPx);

        let html = '';
        lines.forEach(line => {
            html += `<span class="rendered-line" style="height:${lineHeightMm}mm; line-height:${lineHeightMm}mm;">`;
            html += this._renderLineSegments(line.segments || []);
            html += `</span>`;
        });

        return html;
    }

    _renderParagraphPiece(piece) {
        const lines = piece.data.lines || [];
        const lineHeightPx = this.layoutParams.lineHeightPx;
        const lineHeightMm = this._pxToMm(lineHeightPx);

        let html = '';
        lines.forEach(line => {
            html += `<span class="rendered-line" style="height:${lineHeightMm}mm; line-height:${lineHeightMm}mm;">`;
            html += this._renderLineSegments(line.segments || []);
            html += `</span>`;
        });

        return html;
    }

    _renderLineSegments(segments) {
        let html = '';
        segments.forEach(seg => {
            const styles = seg.styles || [];
            const classes = [];
            let hasFootnote = false;
            let fnNum = null;

            styles.forEach(s => {
                if (s.type === window.Types.InlineStyleType.BOLD) classes.push('inline-bold');
                if (s.type === window.Types.InlineStyleType.ITALIC) classes.push('inline-italic');
                if (s.type === window.Types.InlineStyleType.FOOTNOTE_REF) {
                    hasFootnote = true;
                    fnNum = s.footnoteNumber;
                }
            });

            const text = this._escapeHtml(seg.text);
            const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';

            if (hasFootnote) {
                const cleanText = text.replace('¹', '').replace('[ref]', '');
                html += `<span${classAttr}>${cleanText}<sup class="footnote-ref">${fnNum || ''}</sup></span>`;
            } else {
                html += `<span${classAttr}>${text}</span>`;
            }
        });
        return html;
    }

    _renderImagePiece(piece) {
        const [w, h] = piece.data.aspectRatio.split(':').map(Number);
        const ratio = h / w;
        const contentWidthPx = this.layoutParams.contentWidthPx;
        const imgHeightPx = contentWidthPx * ratio;
        const imgHeightMm = this._pxToMm(imgHeightPx);
        const captionFontSizePt = this.layoutParams.fontSizePt * 0.85;

        let html = `<div style="width:100%;height:${imgHeightMm}mm;background:repeating-linear-gradient(45deg,#f8f9fa,#f8f9fa 5mm,#e9ecef 5mm,#e9ecef 10mm);border:1pt dashed #adb5bd;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:4mm;box-sizing:border-box;">`;
        html += `<div style="font-size:${this.layoutParams.fontSizePt}pt;color:#6c757d;">🖼️ ${this._escapeHtml(piece.data.altText || '图片占位')}</div>`;
        html += `<div style="font-size:${this.layoutParams.fontSizePt * 0.7}pt;color:#adb5bd;margin-top:1mm;">${piece.data.aspectRatio}</div>`;
        html += `</div>`;

        if (piece.data.caption) {
            const captionLines = window.LineBreaker.breakLinesMinRaggedness(
                piece.data.caption,
                contentWidthPx,
                ptToPx(captionFontSizePt),
                this.layoutParams.fontFamily
            );
            const lineHeightPx = this.layoutParams.lineHeightPx * 0.85;
            const lineHeightMm = this._pxToMm(lineHeightPx);

            html += `<div class="rendered-image-caption" style="font-size:${captionFontSizePt}pt;margin-top:2mm;text-align:center;color:#495057;">`;
            captionLines.forEach(line => {
                html += `<span class="rendered-line" style="display:block;line-height:${lineHeightMm}mm;">${this._renderLineSegments(line.segments || [])}</span>`;
            });
            html += `</div>`;
        }

        return html;
    }

    _renderTablePiece(piece) {
        const data = piece.data;
        const fontSizePt = this.layoutParams.fontSizePt * 0.9;
        const lineHeight = 1.3;

        let html = `<table class="rendered-table" style="font-size:${fontSizePt}pt;line-height:${lineHeight};">`;

        const showHeader = data.startRow === 0 || data.repeatedHeader;
        if (showHeader) {
            html += '<thead><tr>';
            data.headers.forEach(h => {
                html += `<th>${this._escapeHtml(h)}</th>`;
            });
            html += '</tr></thead>';
        }

        html += '<tbody>';
        const startRow = data.startRow || 0;
        const endRow = startRow + (data.rowCount || data.rows.length);
        for (let i = startRow; i < endRow && i < data.rows.length; i++) {
            html += '<tr>';
            data.rows[i].forEach(cell => {
                html += `<td style="vertical-align:top;padding:1mm 1.5mm;">${this._escapeHtml(cell)}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody>';
        html += '</table>';

        return html;
    }

    _pxToMm(px) {
        return (px / 3.7795275591).toFixed(3);
    }

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    _downloadFile(htmlContent) {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = (this.docTitle || 'document').replace(/[<>:"/\\|?*]/g, '_');
        a.download = `${safeTitle}_${new Date().toISOString().slice(0,10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

if (typeof window !== 'undefined') {
    window.HtmlExporter = HtmlExporter;
}
