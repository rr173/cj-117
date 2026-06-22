class StyleRuleEngine {
    constructor() {
        this.rules = [];
        this.hitCache = new Map();
        this.selectedRuleId = null;
        this.onChange = null;
    }

    setRules(rules) {
        this.rules = rules || [];
        this._invalidateCache();
        this._triggerChange();
    }

    getRules() {
        return this.rules;
    }

    addRule(rule) {
        this.rules.push(rule);
        this._invalidateCache();
        this._triggerChange();
    }

    updateRule(ruleId, updates) {
        const idx = this.rules.findIndex(r => r.id === ruleId);
        if (idx >= 0) {
            this.rules[idx] = { ...this.rules[idx], ...updates };
            this._invalidateCache();
            this._triggerChange();
        }
    }

    deleteRule(ruleId) {
        this.rules = this.rules.filter(r => r.id !== ruleId);
        if (this.selectedRuleId === ruleId) {
            this.selectedRuleId = null;
        }
        this._invalidateCache();
        this._triggerChange();
    }

    moveRule(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.rules.length) return;
        if (toIndex < 0 || toIndex >= this.rules.length) return;
        const [removed] = this.rules.splice(fromIndex, 1);
        this.rules.splice(toIndex, 0, removed);
        this._invalidateCache();
        this._triggerChange();
    }

    toggleRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = !rule.enabled;
            this._invalidateCache();
            this._triggerChange();
        }
    }

    setSelectedRule(ruleId) {
        this.selectedRuleId = ruleId;
        this._triggerChange();
    }

    getSelectedRule() {
        return this.rules.find(r => r.id === this.selectedRuleId) || null;
    }

    _invalidateCache() {
        this.hitCache.clear();
    }

    _triggerChange() {
        if (this.onChange) {
            this.onChange();
        }
    }

    _getBlockText(block) {
        if (!block || !block.data) return '';
        if (block.data.text) return block.data.text;
        if (block.data.caption) return block.data.caption;
        if (block.data.refText) return block.data.refText;
        if (block.data.title) return block.data.title;
        if (block.data.noteText) return block.data.noteText;
        return '';
    }

    _isHeading(block) {
        return block && (
            block.type === window.Types.BlockType.H1 ||
            block.type === window.Types.BlockType.H2 ||
            block.type === window.Types.BlockType.H3
        );
    }

    _checkCondition(block, blocks, blockIndex, condition) {
        if (!condition) return false;

        switch (condition.type) {
            case window.Types.RuleConditionType.BLOCK_TYPE: {
                return block.type === condition.params.blockType;
            }

            case window.Types.RuleConditionType.POSITION_AFTER_HEADING: {
                if (block.type !== window.Types.BlockType.PARAGRAPH) return false;
                if (blockIndex === 0) return false;
                const headingLevel = condition.params.headingLevel;
                for (let i = blockIndex - 1; i >= 0; i--) {
                    const prev = blocks[i];
                    if (prev.type === window.Types.BlockType.PARAGRAPH) {
                        return false;
                    }
                    if (this._isHeading(prev)) {
                        if (!headingLevel) return true;
                        const level = parseInt(prev.type.substring(1));
                        if (level === headingLevel) return true;
                        if (level < headingLevel) return false;
                    }
                }
                return false;
            }

            case window.Types.RuleConditionType.POSITION_LAST: {
                if (block.type !== window.Types.BlockType.PARAGRAPH) return false;
                for (let i = blocks.length - 1; i >= 0; i--) {
                    if (blocks[i].type === window.Types.BlockType.PARAGRAPH) {
                        return i === blockIndex;
                    }
                }
                return false;
            }

            case window.Types.RuleConditionType.CONTENT_CONTAINS: {
                const keyword = condition.params.keyword || '';
                if (!keyword) return false;
                const text = this._getBlockText(block);
                const caseSensitive = condition.params.caseSensitive || false;
                if (caseSensitive) {
                    return text.includes(keyword);
                }
                return text.toLowerCase().includes(keyword.toLowerCase());
            }

            case window.Types.RuleConditionType.CONTENT_LENGTH: {
                if (block.type !== window.Types.BlockType.PARAGRAPH) return false;
                const threshold = condition.params.threshold || 0;
                const text = this._getBlockText(block);
                return text.length > threshold;
            }

            default:
                return false;
        }
    }

    _checkRule(block, blocks, blockIndex, rule) {
        if (!rule || !rule.enabled || rule.conditions.length === 0) {
            return false;
        }
        return rule.conditions.every(cond =>
            this._checkCondition(block, blocks, blockIndex, cond)
        );
    }

    processBlocks(blocks) {
        this.hitCache.clear();
        const results = new Map();

        if (!blocks || blocks.length === 0) {
            return results;
        }

        blocks.forEach((block, blockIndex) => {
            const hitRules = [];
            const mergedStyle = new window.Types.StyleRuleStyle();

            this.rules.forEach(rule => {
                if (this._checkRule(block, blocks, blockIndex, rule)) {
                    hitRules.push(rule);
                    this._mergeStyle(mergedStyle, rule.style);
                }
            });

            results.set(block.id, {
                block,
                blockIndex,
                hitRules,
                mergedStyle
            });

            this.hitCache.set(block.id, hitRules.map(r => r.id));
        });

        return results;
    }

    _mergeStyle(target, source) {
        if (source.color != null) target.color = source.color;
        if (source.backgroundColor != null) target.backgroundColor = source.backgroundColor;
        if (source.leftIndentPx > 0) target.leftIndentPx = source.leftIndentPx;
        if (source.firstLineIndentPx > 0) target.firstLineIndentPx = source.firstLineIndentPx;
        if (source.dropCap) target.dropCap = true;
        if (source.border) {
            target.border = { ...source.border };
        }
    }

    getBlockHitRules(blockId) {
        return this.hitCache.get(blockId) || [];
    }

    getRuleHitCount(ruleId, blocks) {
        if (!blocks) return 0;
        let count = 0;
        const rule = this.rules.find(r => r.id === ruleId);
        if (!rule || !rule.enabled) return 0;

        blocks.forEach((block, idx) => {
            if (this._checkRule(block, blocks, idx, rule)) {
                count++;
            }
        });
        return count;
    }

    styleToCss(style) {
        if (!style) return '';
        const parts = [];
        if (style.color) parts.push(`color: ${style.color}`);
        if (style.backgroundColor) parts.push(`background-color: ${style.backgroundColor}`);
        if (style.leftIndentPx > 0) parts.push(`padding-left: ${style.leftIndentPx}px`);
        if (style.border) {
            const b = style.border;
            if (b.style && b.style !== 'none') {
                const w = b.width || 1;
                const c = b.color || '#000';
                parts.push(`border: ${w}px ${b.style} ${c}`);
                if (b.radius) parts.push(`border-radius: ${b.radius}px`);
            }
        }
        return parts.join('; ');
    }

    export() {
        return JSON.parse(JSON.stringify(this.rules));
    }

    import(data) {
        if (!Array.isArray(data)) return;
        this.rules = data.map(r => {
            const rule = new window.Types.StyleRule(r.name || '导入规则');
            rule.id = r.id || rule.id;
            rule.enabled = r.enabled !== false;
            rule.conditions = (r.conditions || []).map(c =>
                new window.Types.StyleRuleCondition(c.type, c.params || {})
            );
            rule.style = { ...new window.Types.StyleRuleStyle(), ...(r.style || {}) };
            return rule;
        });
        this._invalidateCache();
        this._triggerChange();
    }
}

if (typeof window !== 'undefined') {
    window.StyleRuleEngine = StyleRuleEngine;
}
