class HtmlExporter {
    constructor() {
        this.pages = [];
        this.layoutParams = null;
        this.docTitle = '未命名文档';
        this.documentProcessor = null;
        this.pageNumberOffset = 0;
    }

    setData(pages, layoutParams, docTitle) {
        this.pages = pages;
        this.layoutParams = layoutParams;
        this.docTitle = docTitle || '未命名文档';
    }

    setDocumentProcessor(dp) {
        this.documentProcessor = dp;
    }

    setPageNumberOffset(offset) {
        this.pageNumberOffset = offset;
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

.heading-anchor {
    display: block;
    position: relative;
    top: -5mm;
    visibility: hidden;
}

.heading-number {
    font-weight: 700;
}

.toc-title {
    margin-bottom: 4mm;
}

.toc-entries {
    line-height: 1.6;
}

.toc-entry {
    margin-bottom: 1mm;
}

.toc-link {
    cursor: pointer;
}

.toc-link:hover {
    color: #0984e3 !important;
}

.toc-dot-leader {
    display: inline-block;
}

.toc-page {
    font-variant-numeric: tabular-nums;
}

.rendered-table-caption {
    margin-bottom: 2mm;
}

.cross-ref {
    cursor: default;
}

.cross-ref-invalid {
    color: #d63031;
    font-weight: 600;
}

.cross-ref-valid {
    color: #0984e3;
    cursor: pointer;
}

.cross-ref-valid:hover {
    text-decoration: underline !important;
}

.sidenote-ref {
    font-size: 0.65em;
    vertical-align: super;
    line-height: 0;
    color: #2e7d32;
    font-weight: 600;
}

.sidenote-area {
    position: absolute;
    top: 0;
    right: 0;
    width: ${params.sidenoteWidthMm}mm;
    height: 100%;
    pointer-events: none;
}

.sidenote-item {
    position: absolute;
    left: 0;
    width: 100%;
    font-size: ${params.getSidenoteFontSize()}pt;
    line-height: 1.5;
    color: #495057;
    padding-left: 1mm;
    box-sizing: border-box;
}

.sidenote-number {
    font-weight: 600;
    color: #2e7d32;
}

.sidenote-continuation {
    position: absolute;
    bottom: 2mm;
    left: 0;
    width: 100%;
    font-size: ${params.getSidenoteFontSize()}pt;
    color: #6c757d;
    font-style: italic;
    text-align: right;
    padding-right: 1mm;
    box-sizing: border-box;
}

.sidenote-leaders {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
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

            if (this.layoutParams.showColumnRule && this.layoutParams.columnCount > 1) {
                for (let i = 1; i < this.layoutParams.columnCount; i++) {
                    const leftPx = this.layoutParams.getColumnLeftPx(i) - this.layoutParams.columnGapPx / 2;
                    const leftMm = this._pxToMm(leftPx);
                    html += `<div style="position:absolute;top:0;bottom:0;left:${leftMm}mm;width:0.3pt;background-color:#ced4da;"></div>`;
                }
            }

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

            if (page.sidenotes && page.sidenotes.length > 0) {
                html += this._renderSidenotesForExport(page);
            }

            html += `</div>`;

            if (this.layoutParams.showPageNumber) {
                const displayPageNum = pageIdx - this.pageNumberOffset + 1;
                html += `<div class="page-footer">— ${displayPageNum} —</div>`;
            }

            html += `</div>`;
        });

        return html;
    }

    _renderPiece(piece) {
        const topPx = piece.top;
        const leftPx = piece.left || 0;
        const widthPx = piece.width;
        const heightPx = piece.height;
        const topMm = this._pxToMm(topPx);
        const leftMm = this._pxToMm(leftPx);
        const widthMm = this._pxToMm(widthPx);
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
            case window.Types.BlockType.TOC:
                innerHtml = this._renderTocPiece(piece);
                break;
            case window.Types.BlockType.CROSS_REF:
                innerHtml = this._renderCrossRefPiece(piece);
                break;
            case window.Types.BlockType.MARGIN_NOTE:
                innerHtml = this._renderParagraphPiece(piece);
                break;
        }

        return `<div class="rendered-block rendered-${piece.type}" style="top:${topMm}mm; left:${leftMm}mm; width:${widthMm}mm; height:${heightMm}mm;">${innerHtml}</div>`;
    }

    _renderHeadingPiece(piece) {
        const level = piece.data.level;
        const lines = piece.data.lines || [];
        const fontSizePt = this.layoutParams.getHeadingFontSize(level);
        const fontSizePx = ptToPx(fontSizePt);
        const lineHeightPx = fontSizePx * Math.max(1.2, this.layoutParams.lineHeight - 0.2);
        const lineHeightMm = this._pxToMm(lineHeightPx);

        let html = `<a id="heading-${piece.blockId}" class="heading-anchor"></a>`;
        let numberPrefix = '';
        if (this.documentProcessor) {
            const headingInfo = this.documentProcessor.headingInfo.get(piece.blockId);
            if (headingInfo && this.layoutParams.autoNumberHeading && headingInfo.number) {
                numberPrefix = `<span class="heading-number">${headingInfo.number} </span>`;
            }
        }

        lines.forEach((line, idx) => {
            html += `<span class="rendered-line" style="height:${lineHeightMm}mm; line-height:${lineHeightMm}mm;">`;
            if (idx === 0 && numberPrefix) {
                html += numberPrefix;
            }
            html += this._renderLineSegments(line.segments || []);
            html += `</span>`;
        });

        if (lines.length === 0) {
            let displayText = piece.data.text || '';
            if (this.documentProcessor) {
                displayText = this.documentProcessor.getHeadingDisplay(piece.blockId) || displayText;
            }
            html += this._escapeHtml(displayText);
        }

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
        const usedFootnoteNums = new Set();

        segments.forEach(seg => {
            const styles = seg.styles || [];
            const classes = [];
            let fnNum = null;

            styles.forEach(s => {
                if (s.type === window.Types.InlineStyleType.BOLD) classes.push('inline-bold');
                if (s.type === window.Types.InlineStyleType.ITALIC) classes.push('inline-italic');
                if (s.type === window.Types.InlineStyleType.FOOTNOTE_REF) {
                    if (s.footnoteNumber != null && !usedFootnoteNums.has(s.footnoteNumber)) {
                        fnNum = s.footnoteNumber;
                        usedFootnoteNums.add(s.footnoteNumber);
                    }
                }
                if (s.type === window.Types.InlineStyleType.MARGIN_NOTE_REF) {
                    if (s.noteNumber != null && !usedFootnoteNums.has(s.noteNumber)) {
                        fnNum = s.noteNumber;
                        usedFootnoteNums.add(s.noteNumber);
                    }
                }
            });

            const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
            let cleanText = this._escapeHtml(seg.text).replace(/¹|²|ⁿ|\[ref\]/g, '');

            if (fnNum != null) {
                const isSidenote = styles.some(s => s.type === window.Types.InlineStyleType.MARGIN_NOTE_REF);
                const refClass = isSidenote ? 'sidenote-ref' : 'footnote-ref';
                html += `<span${classAttr}>${cleanText}<sup class="${refClass}" data-note-num="${fnNum}">${fnNum}</sup></span>`;
            } else {
                html += `<span${classAttr}>${cleanText}</span>`;
            }
        });
        return html;
    }

    _renderImagePiece(piece) {
        const [w, h] = piece.data.aspectRatio.split(':').map(Number);
        const ratio = h / w;
        const renderedWidthPx = piece.data.renderedWidth || piece.width || this.layoutParams.contentWidthPx;
        const imgHeightPx = renderedWidthPx * ratio;
        const imgHeightMm = this._pxToMm(imgHeightPx);
        const captionFontSizePt = this.layoutParams.fontSizePt * 0.85;

        let displayCaption = piece.data.caption || '';
        if (this.documentProcessor) {
            displayCaption = this.documentProcessor.getImageCaption(piece.blockId) || displayCaption;
        }

        let html = `<a id="image-${piece.blockId}" class="heading-anchor"></a>`;
        html += `<div style="width:100%;height:${imgHeightMm}mm;background:repeating-linear-gradient(45deg,#f8f9fa,#f8f9fa 5mm,#e9ecef 5mm,#e9ecef 10mm);border:1pt dashed #adb5bd;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:4mm;box-sizing:border-box;">`;
        html += `<div style="font-size:${this.layoutParams.fontSizePt}pt;color:#6c757d;">🖼️ ${this._escapeHtml(piece.data.altText || '图片占位')}</div>`;
        html += `<div style="font-size:${this.layoutParams.fontSizePt * 0.7}pt;color:#adb5bd;margin-top:1mm;">${piece.data.aspectRatio}</div>`;
        html += `</div>`;

        if (displayCaption) {
            const captionLines = window.LineBreaker.breakLinesMinRaggedness(
                displayCaption,
                renderedWidthPx,
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
        const renderedWidthPx = piece.data.renderedWidth || piece.width || this.layoutParams.contentWidthPx;
        const fontSizePt = this.layoutParams.fontSizePt * 0.9;
        const lineHeight = 1.3;

        let displayCaption = piece.data.caption || '';
        if (this.documentProcessor) {
            displayCaption = this.documentProcessor.getTableCaption(piece.blockId) || displayCaption;
        }

        let html = '';

        if (displayCaption && !data.continuation) {
            const captionFontSizePt = this.layoutParams.fontSizePt * 0.9;
            const captionLineHeightPx = this.layoutParams.lineHeightPx * 0.9;
            const captionLineHeightMm = this._pxToMm(captionLineHeightPx);
            const captionLines = window.LineBreaker.breakLinesMinRaggedness(
                displayCaption,
                renderedWidthPx,
                ptToPx(captionFontSizePt),
                this.layoutParams.fontFamily
            );
            html += `<div class="rendered-table-caption" style="font-size:${captionFontSizePt}pt;margin-bottom:2mm;text-align:center;color:#495057;font-weight:600;">`;
            captionLines.forEach(line => {
                html += `<span class="rendered-line" style="display:block;line-height:${captionLineHeightMm}mm;">${this._renderLineSegments(line.segments || [])}</span>`;
            });
            html += `</div>`;
        }

        html += `<a id="table-${piece.blockId}" class="heading-anchor"></a>`;
        html += `<table class="rendered-table" style="font-size:${fontSizePt}pt;line-height:${lineHeight};width:100%;">`;

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

    _renderTocPiece(piece) {
        const params = this.layoutParams;
        const headingSizes = {
            1: params.getHeadingFontSize(1),
            2: params.getHeadingFontSize(2),
            3: params.getHeadingFontSize(3)
        };
        const titleFontSizePt = headingSizes[1];

        let html = `<div class="toc-title" style="font-size:${titleFontSizePt}pt;font-weight:700;text-align:center;margin-bottom:4mm;">${this._escapeHtml(piece.data.title || '目录')}</div>`;

        if (this.documentProcessor) {
            const entries = this.documentProcessor.getTocEntriesWithPageNumbers();
            const entryFontSizePt = params.fontSizePt;

            html += `<div class="toc-entries" style="font-size:${entryFontSizePt}pt;">`;

            entries.forEach(entry => {
                const indentLevel = entry.level - 1;
                const indentMm = indentLevel * 6;
                html += `<div class="toc-entry toc-level-${entry.level}" style="padding-left:${indentMm}mm;display:flex;align-items:baseline;">`;
                html += `<a href="#heading-${entry.blockId}" class="toc-link" style="text-decoration:none;color:inherit;flex-shrink:0;">${this._escapeHtml(entry.displayText)}</a>`;
                html += `<span class="toc-dot-leader" style="flex-grow:1;border-bottom:0.5pt dotted #6c757d;margin:0 2mm;min-width:5mm;"></span>`;
                html += `<span class="toc-page" style="flex-shrink:0;text-align:right;">${entry.displayPage}</span>`;
                html += `</div>`;
            });

            html += `</div>`;
        }

        return html;
    }

    _renderCrossRefPiece(piece) {
        let displayText = '引用失效';
        let invalid = true;
        let targetId = null;

        if (this.documentProcessor) {
            const result = this.documentProcessor.formatCrossRef(piece.blockId);
            displayText = result.text;
            invalid = result.invalid;
            targetId = result.targetId;
        }

        const params = this.layoutParams;
        const fontSizePt = params.fontSizePt;

        let html = '';
        if (invalid) {
            html = `<span class="cross-ref cross-ref-invalid" style="color:#d63031;font-weight:600;font-size:${fontSizePt}pt;">${this._escapeHtml(displayText)}</span>`;
        } else {
            let anchorId = '';
            if (piece.data.targetType === window.Types.CrossRefTargetType.HEADING) {
                anchorId = `heading-${targetId}`;
            } else if (piece.data.targetType === window.Types.CrossRefTargetType.IMAGE) {
                anchorId = `image-${targetId}`;
            } else if (piece.data.targetType === window.Types.CrossRefTargetType.TABLE) {
                anchorId = `table-${targetId}`;
            }
            if (anchorId) {
                html = `<a href="#${anchorId}" class="cross-ref cross-ref-valid" style="color:#0984e3;text-decoration:none;font-size:${fontSizePt}pt;">${this._escapeHtml(displayText)}</a>`;
            } else {
                html = `<span class="cross-ref cross-ref-valid" style="color:#0984e3;font-size:${fontSizePt}pt;">${this._escapeHtml(displayText)}</span>`;
            }
        }

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

    _renderSidenotesForExport(page) {
        const params = this.layoutParams;
        const sidenoteWidthMm = params.sidenoteWidthMm;
        const contentWidthMm = params.pageWidthMm - params.marginLeftMm - params.marginRightMm;
        const contentRightMm = params.marginLeftMm + contentWidthMm;
        const contentLeftMm = params.marginLeftMm;

        const sidenoteLeftMm = params.pageWidthMm - sidenoteWidthMm;

        let html = `<div class="sidenote-area" style="right:0; width:${sidenoteWidthMm}mm;">`;

        if (params.showSidenoteGutterLine) {
            html += `<div style="position:absolute;top:0;left:-1mm;width:0.3pt;height:100%;background-color:#dee2e6;"></div>`;
        }

        const fontSizePt = params.getSidenoteFontSize();
        const fontSizePx = ptToPx(fontSizePt);
        const lineHeightPx = fontSizePx * 1.5;

        let svgHtml = `<svg class="sidenote-leaders" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;">`;

        page.sidenotes.forEach(sidenote => {
            const topMm = this._pxToMm(sidenote.top);
            const heightMm = this._pxToMm(sidenote.height);

            html += `<div class="sidenote-item" data-note-num="${sidenote.number}" style="top:${topMm}mm;">`;

            const fullText = sidenote.number + ' ' + (sidenote.text || '');
            const noteLines = window.LineBreaker.breakLinesMinRaggedness(
                fullText,
                params.getSidenoteWidthPx(),
                fontSizePx,
                params.fontFamily
            );

            let noteText = '';
            let isFirstLine = true;
            noteLines.forEach(line => {
                let lineText = '';
                line.segments.forEach(seg => {
                    lineText += this._escapeHtml(seg.text);
                });
                if (isFirstLine) {
                    const numStr = String(sidenote.number) + ' ';
                    if (lineText.startsWith(numStr)) {
                        lineText = `<span class="sidenote-number">${numStr}</span>${lineText.substring(numStr.length)}`;
                    }
                    isFirstLine = false;
                }
                noteText += `<span style="display:block;font-size:${fontSizePx}px;line-height:${lineHeightPx}px;height:${lineHeightPx}px;overflow:hidden;white-space:nowrap;">${lineText}</span>`;
            });

            html += noteText;
            html += `</div>`;

            const anchorTopMm = this._pxToMm(sidenote.anchorTop + params.fontSizePx * 0.3);
            const noteTopMm = this._pxToMm(sidenote.top + fontSizePx * 0.4);

            const anchorRightMm = contentLeftMm + this._pxToMm(sidenote.anchorLeft) + 0.5;
            const noteLeftAbsMm = sidenoteLeftMm;

            let pathD = '';
            if (Math.abs(parseFloat(anchorTopMm) - parseFloat(noteTopMm)) < 0.5) {
                pathD = `M ${anchorRightMm}mm ${anchorTopMm}mm L ${noteLeftAbsMm}mm ${noteTopMm}mm`;
            } else {
                pathD = `M ${anchorRightMm}mm ${anchorTopMm}mm L ${contentRightMm}mm ${anchorTopMm}mm L ${contentRightMm}mm ${noteTopMm}mm L ${noteLeftAbsMm}mm ${noteTopMm}mm`;
            }

            svgHtml += `<path d="${pathD}" stroke="#adb5bd" stroke-width="0.3pt" fill="none" data-note-num="${sidenote.number}" />`;
        });

        svgHtml += `</svg>`;

        if (page.hasSidenoteContinuation) {
            html += `<div class="sidenote-continuation">(续下页)</div>`;
        }

        html += svgHtml;
        html += `</div>`;

        return html;
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
