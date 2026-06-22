class StyleRuleEditor {
    constructor(containerId, ruleEngine) {
        this.container = document.getElementById(containerId);
        this.ruleEngine = ruleEngine;
        this.draggedRuleId = null;
        this.onChange = null;
        this._render();
    }

    _render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="param-group" style="padding-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin-bottom: 0;">🎨 条件样式规则</h3>
                    <button class="btn btn-primary btn-small" id="btn-add-rule">+ 新建规则</button>
                </div>
                <div class="form-hint" style="margin-bottom: 10px;">从上到下匹配，后定义的规则优先级更高</div>
            </div>
            <div id="rules-list" class="rules-list"></div>
        `;

        this.container.querySelector('#btn-add-rule').addEventListener('click', () => {
            this._addNewRule();
        });

        this._renderRules();
    }

    _renderRules() {
        const listEl = this.container.querySelector('#rules-list');
        if (!listEl) return;

        const rules = this.ruleEngine.getRules();
        const blocks = this._getBlocks();

        if (rules.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center;padding:24px 16px;color:var(--color-text-light);font-size:12px;border:2px dashed var(--color-border);border-radius:var(--radius);margin:0 16px 16px;">
                    暂无规则<br>
                    <small>点击"新建规则"开始创建</small>
                </div>
            `;
            return;
        }

        listEl.innerHTML = '';

        rules.forEach((rule, index) => {
            const hitCount = blocks ? this.ruleEngine.getRuleHitCount(rule.id, blocks) : 0;
            const isSelected = this.ruleEngine.selectedRuleId === rule.id;
            const isInvalid = rule.enabled && hitCount === 0;

            const itemEl = document.createElement('div');
            itemEl.className = `rule-item ${rule.enabled ? '' : 'rule-disabled'} ${isSelected ? 'rule-selected' : ''} ${isInvalid ? 'rule-invalid' : ''}`;
            itemEl.dataset.ruleId = rule.id;
            itemEl.draggable = true;

            itemEl.innerHTML = `
                <div class="rule-header">
                    <div class="rule-drag-handle" title="拖拽调整顺序">⋮⋮</div>
                    <label class="rule-toggle">
                        <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-action="toggle">
                    </label>
                    <div class="rule-name" data-action="edit-name">${this._escapeHtml(rule.name)}</div>
                    <div class="rule-hit-count">
                        <span class="hit-badge ${hitCount > 0 ? 'hit-active' : 'hit-inactive'}">命中 ${hitCount}</span>
                    </div>
                    <div class="rule-actions">
                        <button class="btn btn-small" data-action="delete" title="删除">🗑️</button>
                    </div>
                </div>
                ${isSelected ? this._renderRuleBody(rule) : ''}
            `;

            this._bindRuleEvents(itemEl, rule, index);
            listEl.appendChild(itemEl);
        });
    }

    _renderRuleBody(rule) {
        let conditionsHtml = '';
        rule.conditions.forEach((cond, ci) => {
            conditionsHtml += this._renderCondition(cond, ci, rule);
        });

        const style = rule.style;
        const border = style.border || { style: 'none', width: 1, color: '#000000', radius: 0 };

        return `
            <div class="rule-body">
                <div class="rule-section">
                    <div class="rule-section-header">
                        <span>匹配条件（全部满足）</span>
                        <button class="btn btn-small" data-action="add-condition">+ 添加条件</button>
                    </div>
                    <div class="rule-conditions">
                        ${conditionsHtml || '<div style="padding:8px;color:var(--color-text-light);font-size:12px;font-style:italic;">暂无条件，请先添加</div>'}
                    </div>
                </div>

                <div class="rule-section">
                    <div class="rule-section-header">
                        <span>应用样式</span>
                    </div>
                    <div class="rule-style-grid">
                        <div class="param-row">
                            <label>字体颜色</label>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <input type="color" data-style="color" value="${style.color || '#000000'}">
                                <input type="text" data-style="color-text" value="${style.color || ''}" placeholder="留空不设置" style="flex:1;padding:4px 8px;border:1px solid var(--color-border);border-radius:4px;font-size:12px;">
                            </div>
                        </div>
                        <div class="param-row">
                            <label>背景色</label>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <input type="color" data-style="bgColor" value="${style.backgroundColor || '#ffffff'}">
                                <input type="text" data-style="bgColor-text" value="${style.backgroundColor || ''}" placeholder="留空不设置" style="flex:1;padding:4px 8px;border:1px solid var(--color-border);border-radius:4px;font-size:12px;">
                            </div>
                        </div>
                        <div class="param-row">
                            <label>左缩进 (px)</label>
                            <input type="number" data-style="leftIndentPx" value="${style.leftIndentPx || 0}" min="0" max="200">
                        </div>
                        <div class="param-row">
                            <label>首行缩进 (px)</label>
                            <input type="number" data-style="firstLineIndentPx" value="${style.firstLineIndentPx || 0}" min="0" max="200">
                        </div>
                        <div class="param-row">
                            <label class="checkbox-label">
                                <input type="checkbox" data-style="dropCap" ${style.dropCap ? 'checked' : ''}>
                                首字下沉（段落首字放大占两行）
                            </label>
                        </div>
                        <div class="param-row" style="grid-column: 1 / -1;">
                            <label>边框</label>
                            <div style="display: grid; grid-template-columns: 1fr 80px 1fr 60px; gap: 6px; align-items: center;">
                                <select data-style="borderStyle">
                                    ${window.Types.RuleBorderStyleOptions.map(o =>
                                        `<option value="${o.value}" ${border.style === o.value ? 'selected' : ''}>${o.label}</option>`
                                    ).join('')}
                                </select>
                                <input type="number" data-style="borderWidth" value="${border.width || 1}" min="0" max="20" placeholder="宽度">
                                <input type="color" data-style="borderColor" value="${border.color || '#000000'}">
                                <input type="number" data-style="borderRadius" value="${border.radius || 0}" min="0" max="50" placeholder="圆角">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _renderCondition(cond, ci, rule) {
        let paramsHtml = '';

        switch (cond.type) {
            case window.Types.RuleConditionType.BLOCK_TYPE:
                paramsHtml = `
                    <select data-cond-param="blockType">
                        ${window.Types.RuleBlockTypeOptions.map(o =>
                            `<option value="${o.value}" ${cond.params.blockType === o.value ? 'selected' : ''}>${o.label}</option>`
                        ).join('')}
                    </select>
                `;
                break;
            case window.Types.RuleConditionType.POSITION_AFTER_HEADING:
                paramsHtml = `
                    <select data-cond-param="headingLevel">
                        <option value="">所有层级标题</option>
                        <option value="1" ${cond.params.headingLevel === 1 ? 'selected' : ''}>仅 H1</option>
                        <option value="2" ${cond.params.headingLevel === 2 ? 'selected' : ''}>仅 H2</option>
                        <option value="3" ${cond.params.headingLevel === 3 ? 'selected' : ''}>仅 H3</option>
                    </select>
                `;
                break;
            case window.Types.RuleConditionType.POSITION_LAST:
                paramsHtml = '';
                break;
            case window.Types.RuleConditionType.CONTENT_CONTAINS:
                paramsHtml = `
                    <input type="text" data-cond-param="keyword" value="${cond.params.keyword || ''}" placeholder="关键词" style="flex:1;">
                    <label class="checkbox-label" style="white-space:nowrap;">
                        <input type="checkbox" data-cond-param="caseSensitive" ${cond.params.caseSensitive ? 'checked' : ''}>
                        区分大小写
                    </label>
                `;
                break;
            case window.Types.RuleConditionType.CONTENT_LENGTH:
                paramsHtml = `
                    <span style="font-size:12px;color:var(--color-text-light);">字数超过</span>
                    <input type="number" data-cond-param="threshold" value="${cond.params.threshold || 0}" min="0" style="width:80px;">
                    <span style="font-size:12px;color:var(--color-text-light);">字</span>
                `;
                break;
        }

        return `
            <div class="condition-item" data-cond-index="${ci}">
                <div class="condition-type-select">
                    <select data-cond-type>
                        ${Object.entries(window.Types.RuleConditionTypeLabels).map(([k, v]) =>
                            `<option value="${k}" ${cond.type === k ? 'selected' : ''}>${v}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="condition-params">
                    ${paramsHtml}
                </div>
                <button class="btn btn-small btn-danger" data-action="delete-condition" title="删除条件">×</button>
            </div>
        `;
    }

    _bindRuleEvents(itemEl, rule, index) {
        const ruleId = rule.id;

        itemEl.querySelector('[data-action="toggle"]').addEventListener('change', (e) => {
            e.stopPropagation();
            this.ruleEngine.toggleRule(ruleId);
            this._notifyChange();
            this._renderRules();
        });

        itemEl.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('确定删除这条规则？')) {
                this.ruleEngine.deleteRule(ruleId);
                this._notifyChange();
                this._renderRules();
            }
        });

        itemEl.querySelector('.rule-header').addEventListener('click', (e) => {
            if (e.target.closest('[data-action]')) return;
            if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') return;
            this.ruleEngine.setSelectedRule(
                this.ruleEngine.selectedRuleId === ruleId ? null : ruleId
            );
            this._renderRules();
        });

        itemEl.addEventListener('dragstart', (e) => {
            this.draggedRuleId = ruleId;
            itemEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        itemEl.addEventListener('dragend', () => {
            itemEl.classList.remove('dragging');
            this.draggedRuleId = null;
        });

        itemEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (this.draggedRuleId && this.draggedRuleId !== ruleId) {
                itemEl.classList.add('drag-over');
            }
        });

        itemEl.addEventListener('dragleave', () => {
            itemEl.classList.remove('drag-over');
        });

        itemEl.addEventListener('drop', (e) => {
            e.preventDefault();
            itemEl.classList.remove('drag-over');
            if (this.draggedRuleId && this.draggedRuleId !== ruleId) {
                const rules = this.ruleEngine.getRules();
                const fromIdx = rules.findIndex(r => r.id === this.draggedRuleId);
                const toIdx = rules.findIndex(r => r.id === ruleId);
                this.ruleEngine.moveRule(fromIdx, toIdx);
                this._notifyChange();
                this._renderRules();
            }
        });

        const bodyEl = itemEl.querySelector('.rule-body');
        if (bodyEl) {
            this._bindBodyEvents(bodyEl, rule);
        }
    }

    _bindBodyEvents(bodyEl, rule) {
        bodyEl.querySelector('[data-action="add-condition"]').addEventListener('click', () => {
            const newCond = new window.Types.StyleRuleCondition(
                window.Types.RuleConditionType.BLOCK_TYPE,
                { blockType: window.Types.BlockType.PARAGRAPH }
            );
            rule.conditions.push(newCond);
            this.ruleEngine.updateRule(rule.id, { conditions: rule.conditions });
            this._notifyChange();
            this._renderRules();
        });

        bodyEl.querySelectorAll('.condition-item').forEach(condEl => {
            const ci = parseInt(condEl.dataset.condIndex);

            condEl.querySelector('[data-action="delete-condition"]').addEventListener('click', (e) => {
                e.stopPropagation();
                rule.conditions.splice(ci, 1);
                this.ruleEngine.updateRule(rule.id, { conditions: rule.conditions });
                this._notifyChange();
                this._renderRules();
            });

            condEl.querySelector('[data-cond-type]').addEventListener('change', (e) => {
                const newType = e.target.value;
                const params = {};
                if (newType === window.Types.RuleConditionType.BLOCK_TYPE) {
                    params.blockType = window.Types.BlockType.PARAGRAPH;
                } else if (newType === window.Types.RuleConditionType.CONTENT_CONTAINS) {
                    params.keyword = '';
                    params.caseSensitive = false;
                } else if (newType === window.Types.RuleConditionType.CONTENT_LENGTH) {
                    params.threshold = 50;
                } else if (newType === window.Types.RuleConditionType.POSITION_AFTER_HEADING) {
                    params.headingLevel = null;
                }
                rule.conditions[ci] = new window.Types.StyleRuleCondition(newType, params);
                this.ruleEngine.updateRule(rule.id, { conditions: rule.conditions });
                this._notifyChange();
                this._renderRules();
            });

            condEl.querySelectorAll('[data-cond-param]').forEach(paramEl => {
                paramEl.addEventListener('change', () => {
                    const key = paramEl.dataset.condParam;
                    let value;
                    if (paramEl.type === 'checkbox') {
                        value = paramEl.checked;
                    } else if (paramEl.type === 'number') {
                        value = parseInt(paramEl.value) || 0;
                    } else {
                        value = paramEl.value;
                    }
                    rule.conditions[ci].params[key] = value;
                    this.ruleEngine.updateRule(rule.id, { conditions: rule.conditions });
                    this._notifyChange();
                });
                if (paramEl.type === 'text') {
                    paramEl.addEventListener('input', () => {
                        const key = paramEl.dataset.condParam;
                        rule.conditions[ci].params[key] = paramEl.value;
                        this.ruleEngine.updateRule(rule.id, { conditions: rule.conditions });
                        this._notifyChangeDebounced();
                    });
                }
            });
        });

        bodyEl.querySelectorAll('[data-style]').forEach(styleEl => {
            const key = styleEl.dataset.style;
            styleEl.addEventListener('input', () => {
                this._updateStyleFromInput(rule, key, styleEl);
                this._notifyChangeDebounced();
            });
            styleEl.addEventListener('change', () => {
                this._updateStyleFromInput(rule, key, styleEl);
                this._notifyChange();
                this._renderRules();
            });
        });
    }

    _updateStyleFromInput(rule, key, el) {
        const style = rule.style;

        if (key === 'color') {
            style.color = el.value;
        } else if (key === 'color-text') {
            style.color = el.value || null;
        } else if (key === 'bgColor') {
            style.backgroundColor = el.value;
        } else if (key === 'bgColor-text') {
            style.backgroundColor = el.value || null;
        } else if (key === 'leftIndentPx') {
            style.leftIndentPx = parseInt(el.value) || 0;
        } else if (key === 'firstLineIndentPx') {
            style.firstLineIndentPx = parseInt(el.value) || 0;
        } else if (key === 'dropCap') {
            style.dropCap = el.checked;
        } else if (key === 'borderStyle') {
            if (!style.border) style.border = { style: 'none', width: 1, color: '#000000', radius: 0 };
            style.border.style = el.value;
        } else if (key === 'borderWidth') {
            if (!style.border) style.border = { style: 'none', width: 1, color: '#000000', radius: 0 };
            style.border.width = parseInt(el.value) || 1;
        } else if (key === 'borderColor') {
            if (!style.border) style.border = { style: 'none', width: 1, color: '#000000', radius: 0 };
            style.border.color = el.value;
        } else if (key === 'borderRadius') {
            if (!style.border) style.border = { style: 'none', width: 1, color: '#000000', radius: 0 };
            style.border.radius = parseInt(el.value) || 0;
        }

        this.ruleEngine.updateRule(rule.id, { style: { ...style } });
    }

    _addNewRule() {
        const rule = new window.Types.StyleRule('新规则');
        rule.conditions.push(new window.Types.StyleRuleCondition(
            window.Types.RuleConditionType.BLOCK_TYPE,
            { blockType: window.Types.BlockType.PARAGRAPH }
        ));
        this.ruleEngine.addRule(rule);
        this.ruleEngine.setSelectedRule(rule.id);
        this._notifyChange();
        this._renderRules();
    }

    _getBlocks() {
        if (window.app && window.app.editor) {
            return window.app.editor.getBlocks();
        }
        return null;
    }

    _notifyChange() {
        if (this.onChange) {
            this.onChange();
        }
    }

    _notifyChangeDebounced() {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this._notifyChange();
        }, 200);
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    refresh() {
        this._renderRules();
    }
}

if (typeof window !== 'undefined') {
    window.StyleRuleEditor = StyleRuleEditor;
}
