class LineSegment {
    constructor(text, width, startChar, endChar, styles = []) {
        this.text = text;
        this.width = width;
        this.startChar = startChar;
        this.endChar = endChar;
        this.styles = styles;
    }
}

class Line {
    constructor(segments = [], width = 0, endOfParagraph = false) {
        this.segments = segments;
        this.width = width;
        this.endOfParagraph = endOfParagraph;
    }

    getText() {
        return this.segments.map(s => s.text).join('');
    }
}

class TextMeasurementCanvas {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this._fontCache = {};
        this._widthCache = {};
    }

    setFont(fontSizePx, fontFamily, fontWeight = 'normal', fontStyle = 'normal') {
        const key = `${fontSizePx}px|${fontFamily}|${fontWeight}|${fontStyle}`;
        if (!this._fontCache[key]) {
            this._fontCache[key] = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;
        }
        this.ctx.font = this._fontCache[key];
    }

    measureText(text) {
        if (text === '') return 0;
        const cacheKey = this.ctx.font + '|' + text;
        if (this._widthCache[cacheKey] !== undefined) {
            return this._widthCache[cacheKey];
        }
        const width = this.ctx.measureText(text).width;
        this._widthCache[cacheKey] = width;
        return width;
    }

    clearCache() {
        this._widthCache = {};
    }
}

const textMeasurer = new TextMeasurementCanvas();

function isCJKChar(char) {
    if (!char || char.length === 0) return false;
    const code = char.charCodeAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) ||
           (code >= 0x3400 && code <= 0x4DBF) ||
           (code >= 0x3040 && code <= 0x30FF) ||
           (code >= 0xAC00 && code <= 0xD7AF) ||
           (code >= 0x3000 && code <= 0x303F);
}

function isWhitespace(char) {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function isPunctuation(char) {
    const punctuation = ['，', '。', '！', '？', '、', '；', '：', '"', '"', "'", "'", '（', '）', '《', '》', '〈', '〉', '【', '】', '{', '}', '[', ']', '.', ',', '!', '?', ';', ':', '(', ')', '"', '\''];
    return punctuation.indexOf(char) >= 0;
}

function tokenizeText(text, inlineStyles) {
    const tokens = [];
    let i = 0;

    while (i < text.length) {
        const char = text[i];

        if (isWhitespace(char)) {
            let j = i + 1;
            while (j < text.length && isWhitespace(text[j])) j++;
            tokens.push({
                type: 'space',
                text: ' ',
                startChar: i,
                endChar: j,
                styles: getStylesAtRange(i, j, inlineStyles)
            });
            i = j;
        } else if (isCJKChar(char) || isPunctuation(char)) {
            tokens.push({
                type: 'cjk',
                text: char,
                startChar: i,
                endChar: i + 1,
                styles: getStylesAtRange(i, i + 1, inlineStyles)
            });
            i++;
        } else {
            let j = i + 1;
            while (j < text.length && !isWhitespace(text[j]) && !isCJKChar(text[j]) && !isPunctuation(text[j])) {
                j++;
            }
            tokens.push({
                type: 'word',
                text: text.substring(i, j),
                startChar: i,
                endChar: j,
                styles: getStylesAtRange(i, j, inlineStyles)
            });
            i = j;
        }
    }

    return tokens;
}

function getStylesAtRange(start, end, inlineStyles) {
    return (inlineStyles || []).filter(s =>
        s.start < end && s.end > start
    );
}

function getStyleWeight(styles) {
    let weight = 'normal';
    for (const s of styles) {
        if (s.type === window.Types.InlineStyleType.BOLD) {
            weight = 'bold';
            break;
        }
    }
    return weight;
}

function getStyleItalic(styles) {
    for (const s of styles) {
        if (s.type === window.Types.InlineStyleType.ITALIC) {
            return 'italic';
        }
    }
    return 'normal';
}

function measureTokenWidth(token, fontSizePx, fontFamily) {
    const weight = getStyleWeight(token.styles);
    const style = getStyleItalic(token.styles);
    textMeasurer.setFont(fontSizePx, fontFamily, weight, style);
    return textMeasurer.measureText(token.text);
}

function breakWordIfNeeded(word, maxWidth, fontSizePx, fontFamily, startOffset) {
    const segments = [];
    if (word.text.length <= 1) {
        return [word];
    }

    const weight = getStyleWeight(word.styles);
    const style = getStyleItalic(word.styles);
    textMeasurer.setFont(fontSizePx, fontFamily, weight, style);

    const hyphenWidth = textMeasurer.measureText('-');
    let currentText = '';
    let charIndex = 0;

    while (charIndex < word.text.length) {
        const char = word.text[charIndex];
        const testText = currentText + char;
        const testWidth = textMeasurer.measureText(testText);

        if (testWidth <= maxWidth) {
            currentText += char;
            charIndex++;
        } else {
            if (currentText.length > 1) {
                const withoutLast = currentText.slice(0, -1);
                const withHyphen = withoutLast + '-';
                segments.push({
                    type: 'word_part',
                    text: withHyphen,
                    startChar: word.startChar + startOffset,
                    endChar: word.startChar + startOffset + withoutLast.length,
                    styles: word.styles,
                    _hyphenated: true
                });
                currentText = currentText.slice(-1) + char;
            } else {
                const withHyphen = currentText + '-';
                if (textMeasurer.measureText(withHyphen) <= maxWidth + hyphenWidth) {
                    segments.push({
                        type: 'word_part',
                        text: withHyphen,
                        startChar: word.startChar + startOffset,
                        endChar: word.startChar + startOffset + currentText.length,
                        styles: word.styles,
                        _hyphenated: true
                    });
                    currentText = char;
                } else {
                    segments.push({
                        type: 'word_part',
                        text: currentText,
                        startChar: word.startChar + startOffset,
                        endChar: word.startChar + startOffset + currentText.length,
                        styles: word.styles,
                        _forced: true
                    });
                    currentText = char;
                }
            }
            charIndex++;
        }
    }

    if (currentText.length > 0) {
        segments.push({
            type: 'word_part',
            text: currentText,
            startChar: word.startChar + startOffset + segments.reduce((acc, s) => acc + s.text.replace('-', '').length, 0),
            endChar: word.endChar,
            styles: word.styles
        });
    }

    return segments;
}

function breakLinesMinRaggedness(text, maxWidth, fontSizePx, fontFamily, inlineStyles = []) {
    if (!text || text.trim().length === 0) {
        return [new Line([], 0, true)];
    }

    textMeasurer.clearCache();

    const tokens = tokenizeText(text, inlineStyles);

    if (tokens.length === 0) {
        return [new Line([], 0, true)];
    }

    const items = [];
    for (const token of tokens) {
        const width = measureTokenWidth(token, fontSizePx, fontFamily);

        if (width > maxWidth && token.type === 'word') {
            const parts = breakWordIfNeeded(token, maxWidth, fontSizePx, fontFamily, 0);
            for (const part of parts) {
                const partWidth = measureTokenWidth(part, fontSizePx, fontFamily);
                items.push({ token: part, width: partWidth });
            }
        } else {
            items.push({ token, width });
        }
    }

    const n = items.length;
    const cost = new Array(n + 1).fill(Infinity);
    const next = new Array(n + 1).fill(-1);
    cost[n] = 0;

    const spaceWidth = measureTokenWidth({
        type: 'space',
        text: ' ',
        styles: []
    }, fontSizePx, fontFamily);

    for (let i = n - 1; i >= 0; i--) {
        let currentWidth = 0;
        for (let j = i; j < n; j++) {
            if (j > i && items[j - 1].token.type !== 'cjk' &&
                items[j].token.type !== 'cjk' &&
                items[j - 1].token.type !== 'word_part' &&
                items[j].token.type !== 'word_part') {
                currentWidth += spaceWidth;
            } else if (j > i) {
                const prevIsCJK = items[j - 1].token.type === 'cjk';
                const currIsCJK = items[j].token.type === 'cjk';
                const prevIsWordPart = items[j - 1].token.type === 'word_part';
                const currIsWordPart = items[j].token.type === 'word_part';
                const prevIsSpace = items[j - 1].token.type === 'space';
                const currIsSpace = items[j].token.type === 'space';

                if (!prevIsCJK && !currIsCJK && !prevIsWordPart && !currIsWordPart && !prevIsSpace && !currIsSpace) {
                    currentWidth += spaceWidth;
                } else if (prevIsSpace) {
                    currentWidth += 0;
                }
            }

            currentWidth += items[j].width;

            if (currentWidth > maxWidth && j > i) break;

            const remaining = maxWidth - currentWidth;
            let lineCost;

            if (j === n - 1) {
                lineCost = 0;
            } else {
                lineCost = remaining * remaining;
            }

            if (cost[i] > lineCost + cost[j + 1]) {
                cost[i] = lineCost + cost[j + 1];
                next[i] = j + 1;
            }
        }
    }

    const lines = [];
    let start = 0;
    let lineIndex = 0;

    while (start < n) {
        const end = next[start];
        if (end === -1) break;

        const lineItems = items.slice(start, end);
        const segments = [];
        let lineWidth = 0;
        let prevItem = null;

        for (const item of lineItems) {
            if (prevItem) {
                const prevIsCJK = prevItem.token.type === 'cjk';
                const currIsCJK = item.token.type === 'cjk';
                const prevIsWordPart = prevItem.token.type === 'word_part';
                const currIsWordPart = item.token.type === 'word_part';
                const prevIsSpace = prevItem.token.type === 'space';
                const currIsSpace = item.token.type === 'space';

                if (!prevIsCJK && !currIsCJK && !prevIsWordPart && !currIsWordPart && !prevIsSpace && !currIsSpace) {
                    const spaceSeg = new LineSegment(' ', spaceWidth, -1, -1, []);
                    segments.push(spaceSeg);
                    lineWidth += spaceWidth;
                }
            }

            const seg = new LineSegment(
                item.token.text,
                item.width,
                item.token.startChar,
                item.token.endChar,
                item.token.styles
            );
            segments.push(seg);
            lineWidth += item.width;
            prevItem = item;
        }

        const isLastLine = end >= n;
        lines.push(new Line(segments, lineWidth, isLastLine));

        start = end;
        lineIndex++;
    }

    if (lines.length === 0) {
        return [new Line([], 0, true)];
    }

    return lines;
}

if (typeof window !== 'undefined') {
    window.LineBreaker = {
        LineSegment,
        Line,
        breakLinesMinRaggedness,
        textMeasurer
    };
}
