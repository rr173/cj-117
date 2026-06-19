class PreviewRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.pages = [];
        this.layoutParams = new window.Types.LayoutParams();
        this.zoom = 1;
        this.selectedBlockId = null;
        this.docTitle = '未命名文档';
    }

    setZoom(zoom) {
        this.zoom = zoom;
        this._applyZoom();
    }

    setParams(params) {
        this.layoutParams = params;
    }

    setPages(pages) {
        this.pages = pages;
    }

    setSelectedBlockId(blockId) {
        this.selectedBlockId = blockId;
        this._updateHighlight();
    }

    setDocTitle(title) {
        this.docTitle = title || '未命名文档';
    }

    render() {
        this.container.innerHTML = '';

        if (this.pages.length === 0) {
            this.container.innerHTML = '<div style="color:#95a5a6;padding:60px;text-align:center;">暂无内容</div>';
            return;
        }

        this.pages.forEach((page, idx) => {
            const pageEl = this._createPageElement(page, idx);
            this.container.appendChild(pageEl);
        });

        this._applyZoom();
        this._updatePageInfo();
    }

    _applyZoom() {
        this.container.style.transform = `scale(${this.zoom})`;
        this.container.style.transformOrigin = 'top center';
    }

    _updatePageInfo() {
        const infoEl = document.getElementById('page-info');
        if (infoEl && this.pages.length > 0) {
            infoEl.textContent = `共 ${this.pages.length} 页`;
        }
    }

    _createPageElement(page, pageIndex) {
        const pageEl = document.createElement('div');
        pageEl.className = 'page';
        pageEl.style.width = this.layoutParams.pageWidthPx + 'px';
        pageEl.style.height = this.layoutParams.pageHeightPx + 'px';

        const content = document.createElement('div');
        content.className = 'page-content';

        if (this.layoutParams.showHeader) {
            const header = document.createElement('div');
            header.className = 'page-header';
            header.style.cssText = `
                left: ${this.layoutParams.marginLeftPx}px;
                right: ${this.layoutParams.marginRightPx}px;
                font-size: ${ptToPx(this.layoutParams.getHeaderFontSize())}px;
            `;
            header.textContent = this.docTitle;
            content.appendChild(header);
        }

        const body = document.createElement('div');
        body.className = 'page-body';
        body.style.cssText = `
            top: ${this.layoutParams.marginTopPx}px;
            left: ${this.layoutParams.marginLeftPx}px;
            right: ${this.layoutParams.marginRightPx}px;
            bottom: ${this.layoutParams.marginBottomPx}px;
            font-family: ${this.layoutParams.fontFamily};
            font-size: ${this.layoutParams.fontSizePx}px;
            line-height: ${this.layoutParams.lineHeight};
        `;

        page.pieces.forEach((piece) => {
            const pieceEl = this._createPieceElement(piece);
            body.appendChild(pieceEl);
        });

        if (page.footnotes.length > 0) {
            const footnoteArea = document.createElement('div');
            footnoteArea.className = 'footnote-area';
            footnoteArea.style.cssText = `
                top: auto;
                bottom: 0;
                font-size: ${ptToPx(this.layoutParams.getFootnoteFontSize())}px;
            `;

            page.footnotes.forEach(fn => {
                const fnItem = document.createElement('div');
                fnItem.className = 'footnote-item';
                fnItem.dataset.num = fn.number;
                fnItem.textContent = fn.text;
                footnoteArea.appendChild(fnItem);
            });

            body.appendChild(footnoteArea);
        }

        content.appendChild(body);

        if (this.layoutParams.showPageNumber) {
            const footer = document.createElement('div');
            footer.className = 'page-footer';
            footer.style.cssText = `
                left: ${this.layoutParams.marginLeftPx}px;
                right: ${this.layoutParams.marginRightPx}px;
                font-size: ${ptToPx(this.layoutParams.getFooterFontSize())}px;
            `;
            footer.textContent = `— ${pageIndex + 1} —`;
            content.appendChild(footer);
        }

        pageEl.appendChild(content);
        return pageEl;
    }

    _createPieceElement(piece) {
        const el = document.createElement('div');
        el.className = `rendered-block rendered-${piece.type}`;
        el.style.top = piece.top + 'px';
        el.style.height = piece.height + 'px';
        el.dataset.blockId = piece.blockId;

        if (this.selectedBlockId === piece.blockId) {
            el.classList.add('highlighted');
        }

        switch (piece.type) {
            case window.Types.BlockType.H1:
            case window.Types.BlockType.H2:
            case window.Types.BlockType.H3:
                this._renderHeading(el, piece);
                break;
            case window.Types.BlockType.PARAGRAPH:
                this._renderParagraph(el, piece);
                break;
            case window.Types.BlockType.IMAGE:
                this._renderImage(el, piece);
                break;
            case window.Types.BlockType.TABLE:
                this._renderTable(el, piece);
                break;
            case window.Types.BlockType.FOOTNOTE_REF:
                this._renderFootnoteRef(el, piece);
                break;
        }

        return el;
    }

    _renderHeading(el, piece) {
        const level = piece.data.level;
        const fontSizePt = this.layoutParams.getHeadingFontSize(level);
        const fontSizePx = ptToPx(fontSizePt);
        const lineHeightPx = this.getHeadingHeight(level, fontSizePx);

        el.style.fontSize = fontSizePx + 'px';
        el.style.lineHeight = lineHeightPx + 'px';
        el.style.marginBottom = '0px';

        let marginTop = 0;
        const prevMargin = Math.max(4, this.layoutParams.lineHeightPx * 0.3);
        if (piece.top > 0 && !piece.data.continuation) {
            marginTop = prevMargin;
        }

        const lines = piece.data.lines || [];
        let html = '';
        lines.forEach((line, idx) => {
            html += `<span class="rendered-line" style="height:${lineHeightPx}px;line-height:${lineHeightPx}px;">`;
            html += this._renderLineWithStyles(line.segments || []);
            html += '</span>';
        });

        if (html === '') {
            html = this._escapeHtml(piece.data.text || '');
        }

        el.innerHTML = html;
        if (marginTop > 0) {
            el.style.paddingTop = marginTop + 'px';
            el.style.height = (piece.height + marginTop) + 'px';
        }
    }

    getHeadingHeight(level, fontSizePx) {
        return fontSizePx * Math.max(1.2, this.layoutParams.lineHeight - 0.2);
    }

    _renderParagraph(el, piece) {
        const lines = piece.data.lines || [];
        const lineHeightPx = this.layoutParams.lineHeightPx;

        let html = '';
        lines.forEach((line, idx) => {
            html += `<span class="rendered-line" style="height:${lineHeightPx}px;line-height:${lineHeightPx}px;">`;
            html += this._renderLineWithStyles(line.segments || []);
            html += '</span>';
        });

        el.innerHTML = html;
    }

    _renderLineWithStyles(segments) {
        let html = '';
        const usedFootnoteNums = new Set();

        segments.forEach(seg => {
            let text = seg.text;
            let footnoteNum = null;

            const styles = seg.styles || [];
            const classes = [];

            styles.forEach(s => {
                if (s.type === window.Types.InlineStyleType.BOLD) {
                    classes.push('inline-bold');
                } else if (s.type === window.Types.InlineStyleType.ITALIC) {
                    classes.push('inline-italic');
                } else if (s.type === window.Types.InlineStyleType.FOOTNOTE_REF) {
                    if (s.footnoteNumber != null && !usedFootnoteNums.has(s.footnoteNumber)) {
                        footnoteNum = s.footnoteNumber;
                        usedFootnoteNums.add(s.footnoteNumber);
                    }
                }
            });

            let classAttr = '';
            if (classes.length > 0) {
                classAttr = ` class="${classes.join(' ')}"`;
            }

            let escapedText = this._escapeHtml(text)
                .replace(/¹|²|\[ref\]/g, '');

            if (footnoteNum != null) {
                html += `<span${classAttr}>${escapedText}<sup class="footnote-ref">${footnoteNum}</sup></span>`;
            } else {
                html += `<span${classAttr}>${escapedText}</span>`;
            }
        });

        return html;
    }

    _renderImage(el, piece) {
        const [w, h] = piece.data.aspectRatio.split(':').map(Number);
        const ratio = h / w;
        const contentWidth = this.layoutParams.contentWidthPx;
        const imgHeight = contentWidth * ratio;
        const captionFontSize = this.layoutParams.fontSizePx * 0.85;
        const captionLineHeight = this.layoutParams.lineHeightPx * 0.85;

        const captionLines = window.LineBreaker.breakLinesMinRaggedness(
            piece.data.caption || '',
            contentWidth,
            captionFontSize,
            this.layoutParams.fontFamily
        );
        const captionHeight = captionLines.length * captionLineHeight;

        let html = `<div style="width:100%;height:${imgHeight}px;${this._getImageStyle()}display:flex;align-items:center;justify-content:center;flex-direction:column;padding:10px;box-sizing:border-box;">`;
        html += `<div style="font-size:${this.layoutParams.fontSizePx}px;color:#6c757d;">🖼️ ${this._escapeHtml(piece.data.altText || '图片占位')}</div>`;
        html += `<div style="font-size:${this.layoutParams.fontSizePx * 0.7}px;color:#adb5bd;margin-top:4px;">${piece.data.aspectRatio}</div>`;
        html += `</div>`;

        if (piece.data.caption) {
            html += `<div class="rendered-image-caption" style="font-size:${captionFontSize}px;line-height:${captionLineHeight}px;margin-top:6px;text-align:center;color:#495057;">`;
            captionLines.forEach(line => {
                html += `<span class="rendered-line" style="display:block;">${this._renderLineWithStyles(line.segments || [])}</span>`;
            });
            html += `</div>`;
        }

        el.innerHTML = html;
    }

    _getImageStyle() {
        return `
            background: repeating-linear-gradient(
                45deg,
                #f8f9fa,
                #f8f9fa 10px,
                #e9ecef 10px,
                #e9ecef 20px
            );
            border: 2px dashed #adb5bd;
        `;
    }

    _renderTable(el, piece) {
        const data = piece.data;
        const fontSizePx = this.layoutParams.fontSizePx * 0.9;
        const lineHeightPx = fontSizePx * 1.3;
        const cellPaddingV = 8;

        let html = `<table class="rendered-table" style="font-size:${fontSizePx}px;line-height:${lineHeightPx}px;">`;

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
                html += `<td style="vertical-align:top;padding:${cellPaddingV}px 6px;">${this._escapeHtml(cell)}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody>';
        html += '</table>';

        el.innerHTML = html;
    }

    _renderFootnoteRef(el, piece) {
        this._renderParagraph(el, piece);
    }

    _updateHighlight() {
        const pieces = this.container.querySelectorAll('.rendered-block');
        pieces.forEach(el => {
            if (el.dataset.blockId === this.selectedBlockId) {
                el.classList.add('highlighted');
            } else {
                el.classList.remove('highlighted');
            }
        });

        if (this.selectedBlockId) {
            const highlighted = this.container.querySelector('.rendered-block.highlighted');
            if (highlighted) {
                const pageEl = highlighted.closest('.page');
                if (pageEl) {
                    pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getTotalPages() {
        return this.pages.length;
    }
}

if (typeof window !== 'undefined') {
    window.PreviewRenderer = PreviewRenderer;
}
