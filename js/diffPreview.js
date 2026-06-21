class DiffPreviewRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.layoutParams = new window.Types.LayoutParams();
        this.zoom = 1;
        this.docTitle = '';
        this.documentProcessor = null;
        this.pageNumberOffset = 0;
        this.diffResult = null;
        this.pages = [];
        this.diffBlockMap = new Map();
    }

    setZoom(zoom) {
        this.zoom = zoom;
        this._applyZoom();
    }

    setParams(params) {
        this.layoutParams = params;
    }

    setDocTitle(title) {
        this.docTitle = title || '';
    }

    setDocumentProcessor(dp) {
        this.documentProcessor = dp;
    }

    setPageNumberOffset(offset) {
        this.pageNumberOffset = offset;
    }

    setDiffResult(diffResult) {
        this.diffResult = diffResult;
        this.diffBlockMap.clear();

        if (diffResult && diffResult.changes) {
            diffResult.changes.forEach(change => {
                const blockId = change.blockId;
                this.diffBlockMap.set(blockId, change);
            });
        }
    }

    setPages(pages) {
        this.pages = pages;
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
        const infoEl = document.getElementById('diff-page-info');
        if (infoEl && this.pages.length > 0) {
            infoEl.textContent = `共 ${this.pages.length} 页`;
        }
    }

    _createPageElement(page, pageIndex) {
        const pageEl = document.createElement('div');
        pageEl.className = 'page diff-page';
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
            header.textContent = this.docTitle + '（对比视图）';
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

        if (this.layoutParams.showColumnRule && this.layoutParams.columnCount > 1) {
            for (let i = 1; i < this.layoutParams.columnCount; i++) {
                const rule = document.createElement('div');
                rule.className = 'column-rule';
                const leftPx = this.layoutParams.getColumnLeftPx(i) - this.layoutParams.columnGapPx / 2;
                rule.style.cssText = `
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: ${leftPx}px;
                    width: 1px;
                    background-color: #ced4da;
                `;
                body.appendChild(rule);
            }
        }

        page.pieces.forEach((piece) => {
            const pieceEl = this._createPieceElement(piece);
            body.appendChild(pieceEl);
        });

        if (page.footnotes && page.footnotes.length > 0) {
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
            const displayPageNum = pageIndex - this.pageNumberOffset + 1;
            footer.textContent = `— ${displayPageNum} —`;
            content.appendChild(footer);
        }

        pageEl.appendChild(content);
        return pageEl;
    }

    _createPieceElement(piece) {
        const el = document.createElement('div');
        el.className = `rendered-block rendered-${piece.type}`;
        el.style.top = piece.top + 'px';
        el.style.left = piece.left + 'px';
        el.style.width = piece.width + 'px';
        el.style.height = piece.height + 'px';
        el.dataset.blockId = piece.blockId;

        if (piece.spanning) {
            el.classList.add('spanning-block');
            el.style.zIndex = '1';
        }

        if (piece.floatType && piece.floatType !== window.Types.ImageFloatType.NONE) {
            el.classList.add(`float-${piece.floatType}`);
        }

        const change = this.diffBlockMap.get(piece.blockId);
        let diffType = null;

        if (change && change.type !== window.DiffChangeType.UNCHANGED) {
            diffType = change.type;
            el.classList.add('diff-block');
            el.classList.add(`diff-block-${diffType}`);
        }

        switch (piece.type) {
            case window.Types.BlockType.H1:
            case window.Types.BlockType.H2:
            case window.Types.BlockType.H3:
                this._renderHeading(el, piece, diffType, change);
                break;
            case window.Types.BlockType.PARAGRAPH:
                this._renderParagraph(el, piece, diffType, change);
                break;
            case window.Types.BlockType.IMAGE:
                this._renderImage(el, piece, diffType, change);
                break;
            case window.Types.BlockType.TABLE:
                this._renderTable(el, piece, diffType, change);
                break;
            case window.Types.BlockType.FOOTNOTE_REF:
                this._renderFootnoteRef(el, piece, diffType, change);
                break;
            case window.Types.BlockType.TOC:
                this._renderToc(el, piece, diffType, change);
                break;
            case window.Types.BlockType.CROSS_REF:
                this._renderCrossRef(el, piece, diffType, change);
                break;
        }

        return el;
    }

    _renderHeading(el, piece, diffType, change) {
        const level = piece.data.level;
        const fontSizePt = this.layoutParams.getHeadingFontSize(level);
        const fontSizePx = ptToPx(fontSizePt);
        const lineHeightPx = this._getHeadingHeight(level, fontSizePx);

        el.style.fontSize = fontSizePx + 'px';
        el.style.lineHeight = lineHeightPx + 'px';
        el.style.marginBottom = '0px';

        let marginTop = 0;
        const prevMargin = Math.max(4, this.layoutParams.lineHeightPx * 0.3);
        if (piece.top > 0 && !piece.data.continuation) {
            marginTop = prevMargin;
        }

        let displayText = piece.data.text || '';
        if (this.documentProcessor) {
            displayText = this.documentProcessor.getHeadingDisplay(piece.blockId) || displayText;
        }

        const lines = piece.data.lines || [];
        let html = '';

        if (lines.length > 0) {
            let globalCharOffset = 0;

            lines.forEach((line, idx) => {
                html += `<span class="rendered-line" style="height:${lineHeightPx}px;line-height:${lineHeightPx}px;">`;
                if (idx === 0 && this.documentProcessor) {
                    const headingInfo = this.documentProcessor.headingInfo.get(piece.blockId);
                    if (headingInfo && this.layoutParams.autoNumberHeading && headingInfo.number) {
                        html += `<span class="heading-number">${headingInfo.number} </span>`;
                    }
                }

                if (diffType === window.DiffChangeType.MODIFY && change && change.inlineDiff) {
                    const lineLength = this._getSegmentsTextLength(line.segments || []);
                    html += this._renderLineWithDiff(line.segments || [], change.inlineDiff, globalCharOffset, lineLength);
                    globalCharOffset += lineLength;
                } else {
                    html += this._renderLineWithStyles(line.segments || []);
                }
                html += '</span>';
            });
        }

        if (html === '') {
            if (diffType === window.DiffChangeType.MODIFY && change && change.inlineDiff) {
                html = this._renderTextWithDiff(displayText, change.inlineDiff);
            } else {
                html = this._escapeHtml(displayText);
            }
        }

        el.innerHTML = `<a id="heading-${piece.blockId}" class="heading-anchor"></a>` + html;
        if (marginTop > 0) {
            el.style.paddingTop = marginTop + 'px';
            el.style.height = (piece.height + marginTop) + 'px';
        }

        this._addDiffBadge(el, diffType);
    }

    _getHeadingHeight(level, fontSizePx) {
        return fontSizePx * Math.max(1.2, this.layoutParams.lineHeight - 0.2);
    }

    _renderParagraph(el, piece, diffType, change) {
        const lines = piece.data.lines || [];
        const lineHeightPx = this.layoutParams.lineHeightPx;

        let html = '';
        let globalCharOffset = 0;

        lines.forEach((line, idx) => {
            html += `<span class="rendered-line" style="height:${lineHeightPx}px;line-height:${lineHeightPx}px;">`;
            if (diffType === window.DiffChangeType.MODIFY && change && change.inlineDiff) {
                const lineLength = this._getSegmentsTextLength(line.segments || []);
                html += this._renderLineWithDiff(line.segments || [], change.inlineDiff, globalCharOffset, lineLength);
                globalCharOffset += lineLength;
            } else {
                html += this._renderLineWithStyles(line.segments || []);
            }
            html += '</span>';
        });

        el.innerHTML = html;
        this._addDiffBadge(el, diffType);
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

    _getSegmentsTextLength(segments) {
        let len = 0;
        segments.forEach(seg => {
            len += seg.text.length;
        });
        return len;
    }

    _renderLineWithDiff(segments, inlineDiff, charOffset, charLength) {
        if (!inlineDiff || !inlineDiff.operations) {
            return this._renderLineWithStyles(segments);
        }

        const subOps = this._sliceInlineDiff(inlineDiff.operations, charOffset, charLength);
        return this._renderDiffOperations(subOps, segments);
    }

    _sliceInlineDiff(operations, start, length) {
        const end = start + length;
        const result = [];
        let newTextPos = 0;
        let pendingDeletes = [];

        const flushPendingDeletes = () => {
            if (pendingDeletes.length > 0) {
                pendingDeletes.forEach(d => result.push(d));
                pendingDeletes = [];
            }
        };

        for (let opIdx = 0; opIdx < operations.length; opIdx++) {
            const op = operations[opIdx];

            if (op.type === window.InlineDiffType.DELETE) {
                pendingDeletes.push({ type: op.type, text: op.text });
                continue;
            }

            const opLen = op.text.length;
            const opStartNew = newTextPos;
            const opEndNew = newTextPos + opLen;

            if (opEndNew <= start) {
                newTextPos = opEndNew;
                pendingDeletes = [];
                continue;
            }

            if (opStartNew >= end) {
                break;
            }

            flushPendingDeletes();

            const sliceStart = Math.max(0, start - opStartNew);
            const sliceEnd = Math.min(opLen, end - opStartNew);
            const sliceText = op.text.slice(sliceStart, sliceEnd);

            if (sliceText.length > 0) {
                result.push({ type: op.type, text: sliceText });
            }

            newTextPos = opEndNew;
        }

        if (newTextPos < end && pendingDeletes.length > 0) {
            flushPendingDeletes();
        }

        return result;
    }

    _countNewTextUpTo(operations, untilIdx) {
        let count = 0;
        for (let i = 0; i < untilIdx; i++) {
            if (operations[i].type !== window.InlineDiffType.DELETE) {
                count += operations[i].text.length;
            }
        }
        return count;
    }

    _countNewTextFrom(operations, fromIdx) {
        let count = 0;
        for (let i = fromIdx; i < operations.length; i++) {
            if (operations[i].type !== window.InlineDiffType.DELETE) {
                count += operations[i].text.length;
            }
        }
        return count;
    }

    _renderDiffOperations(operations, segments) {
        let segIdx = 0;
        let segInnerPos = 0;
        let html = '';
        const usedFootnoteNums = new Set();

        const getNextPlainChunk = (length) => {
            let result = '';
            let styles = [];
            let footnoteNum = null;
            let remaining = length;

            while (remaining > 0 && segIdx < segments.length) {
                const seg = segments[segIdx];
                const segRemain = seg.text.length - segInnerPos;
                const take = Math.min(segRemain, remaining);

                if (take > 0) {
                    result += seg.text.slice(segInnerPos, segInnerPos + take);
                    if (result.length === take) {
                        styles = seg.styles || [];
                    }
                    segInnerPos += take;
                    remaining -= take;

                    if (segInnerPos >= seg.text.length) {
                        const segStyles = seg.styles || [];
                        segStyles.forEach(s => {
                            if (s.type === window.Types.InlineStyleType.FOOTNOTE_REF &&
                                s.footnoteNumber != null && !usedFootnoteNums.has(s.footnoteNumber)) {
                                footnoteNum = s.footnoteNumber;
                                usedFootnoteNums.add(s.footnoteNumber);
                            }
                        });
                        segIdx++;
                        segInnerPos = 0;
                    }
                }
            }

            return { text: result, styles, footnoteNum };
        };

        operations.forEach(op => {
            if (op.type === window.InlineDiffType.DELETE) {
                const escaped = this._escapeHtml(op.text);
                html += `<span class="diff-delete">${escaped}</span>`;
            } else if (op.type === window.InlineDiffType.INSERT) {
                const chunk = getNextPlainChunk(op.text.length);
                const escaped = this._escapeHtml(chunk.text);
                const classes = [];
                (chunk.styles || []).forEach(s => {
                    if (s.type === window.Types.InlineStyleType.BOLD) classes.push('inline-bold');
                    if (s.type === window.Types.InlineStyleType.ITALIC) classes.push('inline-italic');
                });
                classes.push('diff-insert');
                const classAttr = ` class="${classes.join(' ')}"`;
                if (chunk.footnoteNum != null) {
                    html += `<span${classAttr}>${escaped}<sup class="footnote-ref">${chunk.footnoteNum}</sup></span>`;
                } else {
                    html += `<span${classAttr}>${escaped}</span>`;
                }
            } else {
                const chunk = getNextPlainChunk(op.text.length);
                const cleaned = this._escapeHtml(chunk.text).replace(/¹|²|\[ref\]/g, '');
                const classes = [];
                (chunk.styles || []).forEach(s => {
                    if (s.type === window.Types.InlineStyleType.BOLD) classes.push('inline-bold');
                    if (s.type === window.Types.InlineStyleType.ITALIC) classes.push('inline-italic');
                });
                const classAttr = classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
                if (chunk.footnoteNum != null) {
                    html += `<span${classAttr}>${cleaned}<sup class="footnote-ref">${chunk.footnoteNum}</sup></span>`;
                } else {
                    html += `<span${classAttr}>${cleaned}</span>`;
                }
            }
        });

        return html;
    }

    _renderTextWithDiff(text, inlineDiff) {
        if (!inlineDiff || !inlineDiff.operations) {
            return this._escapeHtml(text);
        }

        let html = '';
        inlineDiff.operations.forEach(op => {
            const escapedText = this._escapeHtml(op.text);
            if (op.type === window.InlineDiffType.INSERT) {
                html += `<span class="diff-insert">${escapedText}</span>`;
            } else if (op.type === window.InlineDiffType.DELETE) {
                html += `<span class="diff-delete">${escapedText}</span>`;
            } else {
                html += escapedText;
            }
        });

        return html;
    }

    _renderImage(el, piece, diffType, change) {
        const [w, h] = piece.data.aspectRatio.split(':').map(Number);
        const ratio = h / w;
        const renderedWidth = piece.data.renderedWidth || piece.width || this.layoutParams.contentWidthPx;
        const imgHeight = renderedWidth * ratio;
        const captionFontSize = this.layoutParams.fontSizePx * 0.85;
        const captionLineHeight = this.layoutParams.lineHeightPx * 0.85;

        let displayCaption = piece.data.caption || '';
        if (this.documentProcessor) {
            displayCaption = this.documentProcessor.getImageCaption(piece.blockId) || displayCaption;
        }

        const captionLines = window.LineBreaker.breakLinesMinRaggedness(
            displayCaption,
            renderedWidth,
            captionFontSize,
            this.layoutParams.fontFamily
        );
        const captionHeight = captionLines.length * captionLineHeight;

        let html = `<div style="width:100%;height:${imgHeight}px;${this._getImageStyle()}display:flex;align-items:center;justify-content:center;flex-direction:column;padding:10px;box-sizing:border-box;">`;
        html += `<div style="font-size:${this.layoutParams.fontSizePx}px;color:#6c757d;">🖼️ ${this._escapeHtml(piece.data.altText || '图片占位')}</div>`;
        html += `<div style="font-size:${this.layoutParams.fontSizePx * 0.7}px;color:#adb5bd;margin-top:4px;">${piece.data.aspectRatio}</div>`;
        html += `</div>`;

        if (displayCaption) {
            html += `<div class="rendered-image-caption" style="font-size:${captionFontSize}px;line-height:${captionLineHeight}px;margin-top:6px;text-align:center;color:#495057;">`;
            
            if (diffType === window.DiffChangeType.MODIFY && change && change.inlineDiff) {
                html += this._renderTextWithDiff(displayCaption, change.inlineDiff);
            } else {
                captionLines.forEach(line => {
                    html += `<span class="rendered-line" style="display:block;">${this._renderLineWithStyles(line.segments || [])}</span>`;
                });
            }
            html += `</div>`;
        }

        el.innerHTML = `<a id="image-${piece.blockId}" class="heading-anchor"></a>` + html;
        this._addDiffBadge(el, diffType);
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

    _renderTable(el, piece, diffType, change) {
        const data = piece.data;
        const renderedWidth = piece.data.renderedWidth || piece.width || this.layoutParams.contentWidthPx;
        const fontSizePx = this.layoutParams.fontSizePx * 0.9;
        const lineHeightPx = fontSizePx * 1.3;
        const cellPaddingV = 8;

        let displayCaption = piece.data.caption || '';
        if (this.documentProcessor) {
            displayCaption = this.documentProcessor.getTableCaption(piece.blockId) || displayCaption;
        }

        const tableInlineDiff = (diffType === window.DiffChangeType.MODIFY && change && change.inlineDiff && change.inlineDiff.cellDiffs)
            ? change.inlineDiff
            : null;

        let html = '';

        if (displayCaption && !data.continuation) {
            const captionFontSize = this.layoutParams.fontSizePx * 0.9;
            const captionLineHeight = this.layoutParams.lineHeightPx * 0.9;
            const captionLines = window.LineBreaker.breakLinesMinRaggedness(
                displayCaption,
                renderedWidth,
                captionFontSize,
                this.layoutParams.fontFamily
            );
            html += `<div class="rendered-table-caption" style="font-size:${captionFontSize}px;line-height:${captionLineHeight}px;margin-bottom:6px;text-align:center;color:#495057;font-weight:600;">`;
            
            if (tableInlineDiff && tableInlineDiff.captionDiff) {
                html += this._renderTextWithDiff(displayCaption, tableInlineDiff.captionDiff);
            } else if (diffType === window.DiffChangeType.MODIFY && change && change.inlineDiff && !change.inlineDiff.cellDiffs) {
                html += this._renderTextWithDiff(displayCaption, change.inlineDiff);
            } else {
                captionLines.forEach(line => {
                    html += `<span class="rendered-line" style="display:block;">${this._renderLineWithStyles(line.segments || [])}</span>`;
                });
            }
            html += `</div>`;
        }

        html += `<a id="table-${piece.blockId}" class="heading-anchor"></a>`;
        html += `<table class="rendered-table" style="font-size:${fontSizePx}px;line-height:${lineHeightPx}px;width:100%;">`;

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
            data.rows[i].forEach((cell, colIdx) => {
                let cellHtml = '';
                let cellClass = '';

                if (tableInlineDiff) {
                    const cellDiff = window.getCellDiff(tableInlineDiff, i, colIdx);
                    if (cellDiff) {
                        cellHtml = this._renderTextWithDiff(cell != null ? String(cell) : '', cellDiff);
                        cellClass = ' class="diff-table-cell"';
                    } else {
                        cellHtml = this._escapeHtml(cell);
                    }
                } else {
                    cellHtml = this._escapeHtml(cell);
                }

                html += `<td${cellClass} style="vertical-align:top;padding:${cellPaddingV}px 6px;">${cellHtml}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody>';
        html += '</table>';

        el.innerHTML = html;
        this._addDiffBadge(el, diffType);
    }

    _renderFootnoteRef(el, piece, diffType, change) {
        this._renderParagraph(el, piece, diffType, change);
    }

    _renderToc(el, piece, diffType, change) {
        const titleFontSizePt = this.layoutParams.getHeadingFontSize(1);
        const titleFontSizePx = ptToPx(titleFontSizePt);
        const titleLineHeight = titleFontSizePx * Math.max(1.2, this.layoutParams.lineHeight - 0.2);

        let titleHtml = piece.data.title || '目录';
        if (diffType === window.DiffChangeType.MODIFY && change && change.inlineDiff) {
            titleHtml = this._renderTextWithDiff(titleHtml, change.inlineDiff);
        } else {
            titleHtml = this._escapeHtml(titleHtml);
        }

        let html = `<div class="toc-title" style="font-size:${titleFontSizePx}px;line-height:${titleLineHeight}px;font-weight:700;text-align:center;margin-bottom:${this.layoutParams.paragraphSpacingPx}px;">${titleHtml}</div>`;

        if (this.documentProcessor) {
            const entries = this.documentProcessor.getTocEntriesWithPageNumbers();
            const entryFontSizePx = this.layoutParams.fontSizePx;
            const entryLineHeight = this.layoutParams.lineHeightPx;

            html += `<div class="toc-entries" style="font-size:${entryFontSizePx}px;line-height:${entryLineHeight}px;">`;

            entries.forEach(entry => {
                const indentLevel = entry.level - 1;
                const indentPx = indentLevel * 24;
                html += `<div class="toc-entry toc-level-${entry.level}" style="padding-left:${indentPx}px;display:flex;align-items:baseline;position:relative;">`;
                html += `<a href="#heading-${entry.blockId}" class="toc-link" style="text-decoration:none;color:inherit;flex-shrink:0;">${this._escapeHtml(entry.displayText)}</a>`;
                html += `<span class="toc-dot-leader" style="flex-grow:1;border-bottom:1px dotted #6c757d;margin:0 8px;min-width:20px;"></span>`;
                html += `<span class="toc-page" style="flex-shrink:0;text-align:right;">${entry.displayPage}</span>`;
                html += `</div>`;
            });

            html += `</div>`;
        } else {
            html += `<div style="color:#adb5bd;font-style:italic;">（目录自动生成区）</div>`;
        }

        el.innerHTML = html;
        this._addDiffBadge(el, diffType);
    }

    _renderCrossRef(el, piece, diffType, change) {
        let displayText = '引用失效';
        let invalid = true;
        let targetId = null;

        if (this.documentProcessor) {
            const result = this.documentProcessor.formatCrossRef(piece.blockId);
            displayText = result.text;
            invalid = result.invalid;
            targetId = result.targetId;
        }

        const fontSizePx = this.layoutParams.fontSizePx;
        const lineHeightPx = this.layoutParams.lineHeightPx;

        let renderedText = '';
        if (diffType === window.DiffChangeType.MODIFY && change && change.inlineDiff) {
            renderedText = this._renderTextWithDiff(displayText, change.inlineDiff);
        } else {
            renderedText = this._escapeHtml(displayText);
        }

        let html = '';
        if (invalid) {
            html = `<span class="cross-ref cross-ref-invalid" style="color:#d63031;font-weight:600;font-size:${fontSizePx}px;line-height:${lineHeightPx}px;">${renderedText}</span>`;
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
                html = `<a href="#${anchorId}" class="cross-ref cross-ref-valid" style="color:#0984e3;text-decoration:none;font-size:${fontSizePx}px;line-height:${lineHeightPx}px;">${renderedText}</a>`;
            } else {
                html = `<span class="cross-ref cross-ref-valid" style="color:#0984e3;font-size:${fontSizePx}px;line-height:${lineHeightPx}px;">${renderedText}</span>`;
            }
        }

        el.innerHTML = html;
        this._addDiffBadge(el, diffType);
    }

    _addDiffBadge(el, diffType) {
        if (!diffType || diffType === window.DiffChangeType.UNCHANGED) return;

        const badge = document.createElement('div');
        badge.className = `diff-badge diff-badge-${diffType}`;

        let label = '';
        switch (diffType) {
            case window.DiffChangeType.INSERT:
                label = '➕ 插入';
                break;
            case window.DiffChangeType.DELETE:
                label = '➖ 删除';
                break;
            case window.DiffChangeType.MODIFY:
                label = '✏️ 修改';
                break;
        }
        badge.textContent = label;
        el.appendChild(badge);
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
    window.DiffPreviewRenderer = DiffPreviewRenderer;
}
