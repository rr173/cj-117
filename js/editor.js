class ContentEditor {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.blocks = [];
        this.selectedBlockId = null;
        this.draggedBlockId = null;
        this.onChange = null;
        this.onSelect = null;
        this.modal = null;
        this.editingBlockId = null;
        this._initEventListeners();
        this._initModal();
    }

    _initEventListeners() {
        document.querySelectorAll('.btn-block-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.addBlock(type);
            });
        });
    }

    _initModal() {
        this.modal = document.getElementById('block-editor-modal');
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-save').addEventListener('click', () => this.saveModal());

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
    }

    setBlocks(blocks) {
        this.blocks = blocks;
        this.render();
    }

    getBlocks() {
        return this.blocks;
    }

    getSelectedBlockId() {
        return this.selectedBlockId;
    }

    addBlock(type, index = -1) {
        const block = new window.Types.ContentBlock(type);
        if (index < 0 || index >= this.blocks.length) {
            this.blocks.push(block);
        } else {
            this.blocks.splice(index, 0, block);
        }
        this.render();
        this._notifyChange();

        setTimeout(() => this.openBlockEditor(block.id), 100);
    }

    deleteBlock(blockId) {
        const index = this.blocks.findIndex(b => b.id === blockId);
        if (index >= 0) {
            this.blocks.splice(index, 1);
            if (this.selectedBlockId === blockId) {
                this.selectedBlockId = null;
            }
            this.render();
            this._notifyChange();
        }
    }

    moveBlock(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= this.blocks.length) return;
        if (toIndex < 0 || toIndex >= this.blocks.length) return;

        const [block] = this.blocks.splice(fromIndex, 1);
        this.blocks.splice(toIndex, 0, block);
        this.render();
        this._notifyChange();
    }

    duplicateBlock(blockId) {
        const index = this.blocks.findIndex(b => b.id === blockId);
        if (index >= 0) {
            const original = this.blocks[index];
            const newBlock = new window.Types.ContentBlock(original.type, JSON.parse(JSON.stringify(original.data)));
            this.blocks.splice(index + 1, 0, newBlock);
            this.render();
            this._notifyChange();
        }
    }

    updateBlock(blockId, data) {
        const block = this.blocks.find(b => b.id === blockId);
        if (block) {
            block.data = { ...block.data, ...data };
            this.render();
            this._notifyChange();
        }
    }

    selectBlock(blockId) {
        this.selectedBlockId = blockId;
        this.render();
        if (this.onSelect) {
            this.onSelect(blockId);
        }
    }

    render() {
        this.container.innerHTML = '';

        if (this.blocks.length === 0) {
            const emptyHint = document.createElement('div');
            emptyHint.style.cssText = `
                text-align: center;
                padding: 40px 20px;
                color: #b2bec3;
                font-size: 13px;
                border: 2px dashed #dfe6e9;
                border-radius: 8px;
            `;
            emptyHint.innerHTML = '📋 还没有内容块<br><small>点击上方按钮添加内容</small>';
            this.container.appendChild(emptyHint);
            return;
        }

        this.blocks.forEach((block, index) => {
            const item = this._createBlockElement(block, index);
            this.container.appendChild(item);
        });
    }

    _createBlockElement(block, index) {
        const item = document.createElement('div');
        item.className = 'block-item';
        item.dataset.blockId = block.id;
        item.draggable = true;

        if (block.id === this.selectedBlockId) {
            item.classList.add('selected');
        }

        const header = document.createElement('div');
        header.className = 'block-header';

        const leftPart = document.createElement('div');
        leftPart.style.display = 'flex';
        leftPart.style.alignItems = 'center';
        leftPart.style.gap = '8px';

        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.title = '拖拽排序';
        leftPart.appendChild(dragHandle);

        const badge = document.createElement('span');
        badge.className = 'block-type-badge';
        badge.textContent = window.Types.BlockTypeLabels[block.type] || block.type;
        leftPart.appendChild(badge);

        header.appendChild(leftPart);

        const actions = document.createElement('div');
        actions.className = 'block-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn';
        editBtn.innerHTML = '✏️';
        editBtn.title = '编辑';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openBlockEditor(block.id);
        });
        actions.appendChild(editBtn);

        const dupBtn = document.createElement('button');
        dupBtn.className = 'btn';
        dupBtn.innerHTML = '📋';
        dupBtn.title = '复制';
        dupBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.duplicateBlock(block.id);
        });
        actions.appendChild(dupBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger';
        delBtn.innerHTML = '🗑️';
        delBtn.title = '删除';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('确定要删除这个内容块吗？')) {
                this.deleteBlock(block.id);
            }
        });
        actions.appendChild(delBtn);

        header.appendChild(actions);

        item.appendChild(header);

        const preview = this._createBlockPreview(block);
        item.appendChild(preview);

        item.addEventListener('click', () => {
            this.selectBlock(block.id);
        });

        item.addEventListener('dblclick', () => {
            this.openBlockEditor(block.id);
        });

        item.addEventListener('dragstart', (e) => {
            this.draggedBlockId = block.id;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', block.id);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.querySelectorAll('.block-item').forEach(el => {
                el.classList.remove('drag-over');
            });
            this.draggedBlockId = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.draggedBlockId && this.draggedBlockId !== block.id) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');

            if (this.draggedBlockId && this.draggedBlockId !== block.id) {
                const fromIndex = this.blocks.findIndex(b => b.id === this.draggedBlockId);
                const toIndex = index;
                this.moveBlock(fromIndex, toIndex);
            }
        });

        return item;
    }

    _createBlockPreview(block) {
        const preview = document.createElement('div');
        preview.className = 'block-preview';

        let content = '';

        switch (block.type) {
            case window.Types.BlockType.H1:
            case window.Types.BlockType.H2:
            case window.Types.BlockType.H3:
                content = block.data.text || '<em class="block-empty-hint">（空标题，双击编辑）</em>';
                preview.innerHTML = `<strong style="font-size:${block.type === 'h1' ? '16px' : block.type === 'h2' ? '14px' : '13px'}">${this._escapeHtml(content)}</strong>`;
                break;

            case window.Types.BlockType.PARAGRAPH:
                if (block.data.text) {
                    preview.innerHTML = this._renderTextWithStyles(block.data.text, block.data.inlineStyles || []);
                } else {
                    preview.innerHTML = '<em class="block-empty-hint">（空段落，双击编辑）</em>';
                }
                break;

            case window.Types.BlockType.IMAGE:
                preview.innerHTML = `
                    <div style="padding:8px;background:#f8f9fa;border:1px dashed #dee2e6;border-radius:4px;text-align:center;">
                        🖼️ 图片 [${block.data.aspectRatio}]
                        ${block.data.caption ? `<br><small style="color:#6c757d">${this._escapeHtml(block.data.caption)}</small>` : ''}
                    </div>
                `;
                break;

            case window.Types.BlockType.TABLE:
                const colCount = block.data.columns;
                let tableHtml = `<small style="color:#6c757d">📊 表格 ${colCount}列 × ${block.data.rows.length}行</small>`;
                if (block.data.caption) {
                    tableHtml += `<br><small style="color:#495057;font-weight:600;">${this._escapeHtml(block.data.caption)}</small>`;
                }
                tableHtml += '<br><table style="width:100%;font-size:10px;border-collapse:collapse;margin-top:4px;">';
                tableHtml += '<tr style="background:#e9ecef">';
                block.data.headers.forEach(h => {
                    tableHtml += `<th style="border:1px solid #dee2e6;padding:2px 4px;">${this._escapeHtml(h)}</th>`;
                });
                tableHtml += '</tr>';
                block.data.rows.slice(0, 2).forEach(row => {
                    tableHtml += '<tr>';
                    row.forEach(cell => {
                        tableHtml += `<td style="border:1px solid #dee2e6;padding:2px 4px;">${this._escapeHtml(cell)}</td>`;
                    });
                    tableHtml += '</tr>';
                });
                if (block.data.rows.length > 2) {
                    tableHtml += `<tr><td colspan="${colCount}" style="text-align:center;color:#adb5bd;padding:2px;">... 还有 ${block.data.rows.length - 2} 行</td></tr>`;
                }
                tableHtml += '</table>';
                preview.innerHTML = tableHtml;
                break;

            case window.Types.BlockType.FOOTNOTE_REF:
                preview.innerHTML = `
                    <span>${this._escapeHtml(block.data.refText || '引用文本')}</span>
                    <sup style="color:#0984e3;font-weight:600;">[脚注]</sup>
                    <div style="margin-top:4px;padding:4px 8px;background:#fff3cd;border-radius:3px;font-size:11px;">
                        脚注内容: ${this._escapeHtml(block.data.footnoteText || '(空)')}
                    </div>
                `;
                break;

            case window.Types.BlockType.TOC:
                preview.innerHTML = `
                    <div style="padding:8px;background:#e8f4fc;border:1px dashed #74b9ff;border-radius:4px;text-align:center;">
                        📑 <strong>${this._escapeHtml(block.data.title || '目录')}</strong>
                        <br><small style="color:#6c757d">（自动生成，扫描全文标题）</small>
                    </div>
                `;
                break;

            case window.Types.BlockType.CROSS_REF: {
                let targetLabel = '未选择目标';
                if (block.data.targetType === window.Types.CrossRefTargetType.HEADING) {
                    targetLabel = '📌 标题';
                } else if (block.data.targetType === window.Types.CrossRefTargetType.IMAGE) {
                    targetLabel = '🖼️ 图片';
                } else if (block.data.targetType === window.Types.CrossRefTargetType.TABLE) {
                    targetLabel = '📊 表格';
                }
                preview.innerHTML = `
                    <div style="padding:8px;background:#fff3cd;border:1px dashed #fdcb6e;border-radius:4px;">
                        🔗 交叉引用 → <strong>${targetLabel}</strong>
                        ${block.data.targetId ? `<br><small style="color:#6c757d">目标ID: ${this._escapeHtml(block.data.targetId)}</small>` : '<br><small style="color:#d63031">请双击编辑选择引用目标</small>'}
                    </div>
                `;
                break;
            }

            default:
                preview.textContent = '未知类型';
        }

        return preview;
    }

    _renderTextWithStyles(text, styles) {
        if (!text) return '';

        const sortedStyles = [...styles].sort((a, b) => a.start - b.start);
        let result = '';
        let currentPos = 0;

        const activeStyles = new Set();
        const styleStack = [];

        for (let i = 0; i < text.length; i++) {
            while (sortedStyles.length > 0 && sortedStyles[0].start === i) {
                const s = sortedStyles.shift();
                activeStyles.add(s);
                styleStack.push(s);

                if (s.type === window.Types.InlineStyleType.BOLD) {
                    result += '<strong>';
                } else if (s.type === window.Types.InlineStyleType.ITALIC) {
                    result += '<em>';
                } else if (s.type === window.Types.InlineStyleType.FOOTNOTE_REF) {
                    result += `<sup style="color:#0984e3;font-weight:600;">[${s.footnoteNumber || 'fn'}]</sup>`;
                }
            }

            result += this._escapeHtml(text[i]);

            for (let j = styleStack.length - 1; j >= 0; j--) {
                const s = styleStack[j];
                if (s.end === i + 1) {
                    activeStyles.delete(s);
                    styleStack.splice(j, 1);

                    if (s.type === window.Types.InlineStyleType.BOLD) {
                        result += '</strong>';
                    } else if (s.type === window.Types.InlineStyleType.ITALIC) {
                        result += '</em>';
                    }
                }
            }
        }

        while (styleStack.length > 0) {
            const s = styleStack.pop();
            if (s.type === window.Types.InlineStyleType.BOLD) {
                result += '</strong>';
            } else if (s.type === window.Types.InlineStyleType.ITALIC) {
                result += '</em>';
            }
        }

        return result;
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openBlockEditor(blockId) {
        const block = this.blocks.find(b => b.id === blockId);
        if (!block) return;

        this.editingBlockId = blockId;
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');

        modalTitle.textContent = '编辑 ' + (window.Types.BlockTypeLabels[block.type] || block.type);
        modalBody.innerHTML = '';

        switch (block.type) {
            case window.Types.BlockType.H1:
            case window.Types.BlockType.H2:
            case window.Types.BlockType.H3:
                modalBody.innerHTML = this._createHeadingEditor(block);
                break;

            case window.Types.BlockType.PARAGRAPH:
                modalBody.innerHTML = this._createParagraphEditor(block);
                break;

            case window.Types.BlockType.IMAGE:
                modalBody.innerHTML = this._createImageEditor(block);
                break;

            case window.Types.BlockType.TABLE:
                modalBody.innerHTML = this._createTableEditor(block);
                this._initTableEditorEvents(block);
                break;

            case window.Types.BlockType.FOOTNOTE_REF:
                modalBody.innerHTML = this._createFootnoteEditor(block);
                break;

            case window.Types.BlockType.TOC:
                modalBody.innerHTML = this._createTocEditor(block);
                break;

            case window.Types.BlockType.CROSS_REF:
                modalBody.innerHTML = this._createCrossRefEditor(block);
                this._initCrossRefEditorEvents(block);
                break;
        }

        this.modal.classList.remove('hidden');
    }

    _initCrossRefEditorEvents(block) {
        const editor = this;
        const targetTypeSelect = document.getElementById('edit-ref-target-type');
        const targetIdSelect = document.getElementById('edit-ref-target-id');

        targetTypeSelect.addEventListener('change', () => {
            editor._updateCrossRefTargetOptions(targetTypeSelect.value, block.data.targetId);
        });

        this._updateCrossRefTargetOptions(targetTypeSelect.value, block.data.targetId);
    }

    _updateCrossRefTargetOptions(selectedType, currentTargetId) {
        const dp = window.app ? window.app.documentProcessor : null;
        const targetIdSelect = document.getElementById('edit-ref-target-id');

        if (!dp) {
            targetIdSelect.innerHTML = '<option value="">（系统初始化中）</option>';
            return;
        }

        const allTargets = dp.getAvailableTargets();
        const filteredTargets = allTargets.filter(t => t.type === selectedType);

        if (filteredTargets.length === 0) {
            const typeName = {
                heading: '标题',
                image: '图片',
                table: '表格'
            }[selectedType] || selectedType;
            targetIdSelect.innerHTML = `<option value="">（暂无可用的${typeName}，请先添加）</option>`;
            return;
        }

        targetIdSelect.innerHTML = filteredTargets.map(t =>
            `<option value="${t.id}" data-type="${t.type}" ${currentTargetId === t.id ? 'selected' : ''}>${this._escapeHtml(t.label)}</option>`
        ).join('');
    }

    _createHeadingEditor(block) {
        return `
            <div class="form-group">
                <label>标题文本</label>
                <input type="text" id="edit-text" value="${this._escapeHtml(block.data.text)}" placeholder="输入标题内容">
            </div>
        `;
    }

    _createParagraphEditor(block) {
        const text = block.data.text || '';
        return `
            <div class="form-group">
                <label>段落内容</label>
                <textarea id="edit-text" placeholder="输入段落内容...">${this._escapeHtml(text)}</textarea>
                <div class="form-hint">
                    支持的标记语法：<br>
                    • <code>**加粗文字**</code> → <strong>加粗文字</strong><br>
                    • <code>*斜体文字*</code> → <em>斜体文字</em><br>
                    • <code>[!脚注内容!]</code> → 插入脚注引用
                </div>
            </div>
        `;
    }

    _createImageEditor(block) {
        return `
            <div class="form-group">
                <label>宽高比</label>
                <select id="edit-ratio">
                    <option value="1:1" ${block.data.aspectRatio === '1:1' ? 'selected' : ''}>1:1 正方形</option>
                    <option value="4:3" ${block.data.aspectRatio === '4:3' ? 'selected' : ''}>4:3 标准</option>
                    <option value="16:9" ${block.data.aspectRatio === '16:9' ? 'selected' : ''}>16:9 宽屏</option>
                    <option value="3:4" ${block.data.aspectRatio === '3:4' ? 'selected' : ''}>3:4 竖版</option>
                    <option value="9:16" ${block.data.aspectRatio === '9:16' ? 'selected' : ''}>9:16 手机竖屏</option>
                    <option value="2:1" ${block.data.aspectRatio === '2:1' ? 'selected' : ''}>2:1 超宽</option>
                    <option value="1:2" ${block.data.aspectRatio === '1:2' ? 'selected' : ''}>1:2 超高</option>
                </select>
            </div>
            <div class="form-group">
                <label>图片标题 (caption)</label>
                <input type="text" id="edit-caption" value="${this._escapeHtml(block.data.caption)}" placeholder="图片说明文字">
            </div>
            <div class="form-group">
                <label>占位提示文字</label>
                <input type="text" id="edit-alt" value="${this._escapeHtml(block.data.altText)}" placeholder="显示在图片区域内的提示文字">
            </div>
        `;
    }

    _createTableEditor(block) {
        let html = `
            <div class="form-group">
                <label>表格标题</label>
                <input type="text" id="edit-table-caption" value="${this._escapeHtml(block.data.caption || '')}" placeholder="例如：功能模块对比表">
            </div>
            <div class="form-group">
                <label>列数</label>
                <div style="display:flex;gap:8px;align-items:center;">
                    <input type="number" id="edit-cols" value="${block.data.columns}" min="1" max="20" style="width:100px;">
                    <button class="btn" id="btn-apply-cols">应用列数</button>
                </div>
            </div>
            <div class="form-group">
                <label>表格内容</label>
                <div class="table-toolbar">
                    <button class="btn" id="btn-add-row">+ 添加行</button>
                    <button class="btn" id="btn-del-row">− 删除末行</button>
                </div>
                <div class="table-editor">
                    <table id="edit-table">
                        <thead>
                            <tr id="table-header-row">
                                ${block.data.headers.map((h, i) => `<th><input type="text" value="${this._escapeHtml(h)}" data-header="${i}"></th>`).join('')}
                            </tr>
                        </thead>
                        <tbody id="table-body">
                            ${block.data.rows.map((row, rIdx) => `
                                <tr data-row="${rIdx}">
                                    ${row.map((cell, cIdx) => `<td><input type="text" value="${this._escapeHtml(cell)}" data-row="${rIdx}" data-col="${cIdx}"></td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        return html;
    }

    _initTableEditorEvents(block) {
        const tableEditor = this;

        document.getElementById('btn-apply-cols').addEventListener('click', () => {
            const newCols = parseInt(document.getElementById('edit-cols').value) || 3;
            const currentHeaders = this._collectTableData();
            const currentCols = block.data.columns;

            let newHeaders = [...currentHeaders.headers];
            let newRows = currentHeaders.rows.map(r => [...r]);

            if (newCols > currentCols) {
                for (let i = currentCols; i < newCols; i++) {
                    newHeaders.push(`列${i + 1}`);
                    newRows.forEach(r => r.push(''));
                }
            } else if (newCols < currentCols) {
                newHeaders = newHeaders.slice(0, newCols);
                newRows = newRows.map(r => r.slice(0, newCols));
            }

            block.data.columns = newCols;
            block.data.headers = newHeaders;
            block.data.rows = newRows;

            this.openBlockEditor(block.id);
        });

        document.getElementById('btn-add-row').addEventListener('click', () => {
            const data = this._collectTableData();
            block.data.headers = data.headers;
            block.data.rows = data.rows;
            block.data.rows.push(new Array(block.data.columns).fill(''));
            this.openBlockEditor(block.id);
        });

        document.getElementById('btn-del-row').addEventListener('click', () => {
            if (block.data.rows.length <= 1) {
                alert('至少保留一行数据');
                return;
            }
            const data = this._collectTableData();
            block.data.headers = data.headers;
            block.data.rows = data.rows;
            block.data.rows.pop();
            this.openBlockEditor(block.id);
        });
    }

    _collectTableData() {
        const headers = [];
        document.querySelectorAll('#table-header-row th input').forEach(input => {
            headers.push(input.value);
        });

        const rows = [];
        document.querySelectorAll('#table-body tr').forEach(tr => {
            const row = [];
            tr.querySelectorAll('input').forEach(input => {
                row.push(input.value);
            });
            rows.push(row);
        });

        return { headers, rows };
    }

    _createFootnoteEditor(block) {
        return `
            <div class="form-group">
                <label>引用文本（正文中显示的部分）</label>
                <input type="text" id="edit-ref-text" value="${this._escapeHtml(block.data.refText)}" placeholder="例如：相关研究表明">
            </div>
            <div class="form-group">
                <label>脚注内容（页底显示的部分）</label>
                <textarea id="edit-footnote-text" placeholder="输入脚注详细内容...">${this._escapeHtml(block.data.footnoteText)}</textarea>
            </div>
        `;
    }

    _createTocEditor(block) {
        return `
            <div class="form-group">
                <label>目录标题</label>
                <input type="text" id="edit-toc-title" value="${this._escapeHtml(block.data.title || '目录')}" placeholder="例如：目录、目次">
            </div>
            <div class="form-hint">
                目录内容会自动扫描全文的 H1、H2、H3 标题并生成带层级缩进和页码的条目。<br>
                修改标题内容或顺序后，目录会自动更新。
            </div>
        `;
    }

    _createCrossRefEditor(block) {
        const dp = window.app ? window.app.documentProcessor : null;
        const targets = dp ? dp.getAvailableTargets() : [];

        const typeOptions = `
            <option value="${window.Types.CrossRefTargetType.HEADING}" ${block.data.targetType === window.Types.CrossRefTargetType.HEADING ? 'selected' : ''}>标题</option>
            <option value="${window.Types.CrossRefTargetType.IMAGE}" ${block.data.targetType === window.Types.CrossRefTargetType.IMAGE ? 'selected' : ''}>图片</option>
            <option value="${window.Types.CrossRefTargetType.TABLE}" ${block.data.targetType === window.Types.CrossRefTargetType.TABLE ? 'selected' : ''}>表格</option>
        `;

        let targetOptions = '<option value="">（请先选择引用目标类型）</option>';
        if (targets.length > 0) {
            targetOptions = targets.map(t =>
                `<option value="${t.id}" data-type="${t.type}" ${block.data.targetId === t.id ? 'selected' : ''}>${this._escapeHtml(t.label)}</option>`
            ).join('');
        } else {
            targetOptions = '<option value="">（暂无可用目标，请先添加标题、图片或表格）</option>';
        }

        return `
            <div class="form-group">
                <label>引用目标类型</label>
                <select id="edit-ref-target-type">
                    ${typeOptions}
                </select>
            </div>
            <div class="form-group">
                <label>选择引用目标</label>
                <select id="edit-ref-target-id">
                    ${targetOptions}
                </select>
            </div>
            <div class="form-hint">
                交叉引用会在预览中自动显示为目标的编号和页码（如"图3(第5页)"、"第2.1节(第3页)"）。<br>
                当目标内容移动或编号变化时，所有引用会自动更新。
            </div>
        `;
    }

    closeModal() {
        this.modal.classList.add('hidden');
        this.editingBlockId = null;
    }

    saveModal() {
        if (!this.editingBlockId) return;

        const block = this.blocks.find(b => b.id === this.editingBlockId);
        if (!block) return;

        switch (block.type) {
            case window.Types.BlockType.H1:
            case window.Types.BlockType.H2:
            case window.Types.BlockType.H3: {
                const text = document.getElementById('edit-text').value;
                this.updateBlock(block.id, { text });
                break;
            }

            case window.Types.BlockType.PARAGRAPH: {
                const rawText = document.getElementById('edit-text').value;
                const parsed = this._parseMarkdownSyntax(rawText);
                this.updateBlock(block.id, { text: parsed.text, inlineStyles: parsed.styles });
                break;
            }

            case window.Types.BlockType.IMAGE: {
                const aspectRatio = document.getElementById('edit-ratio').value;
                const caption = document.getElementById('edit-caption').value;
                const altText = document.getElementById('edit-alt').value;
                this.updateBlock(block.id, { aspectRatio, caption, altText });
                break;
            }

            case window.Types.BlockType.TABLE: {
                const caption = document.getElementById('edit-table-caption').value;
                const data = this._collectTableData();
                this.updateBlock(block.id, { caption, headers: data.headers, rows: data.rows });
                break;
            }

            case window.Types.BlockType.FOOTNOTE_REF: {
                const refText = document.getElementById('edit-ref-text').value;
                const footnoteText = document.getElementById('edit-footnote-text').value;
                this.updateBlock(block.id, { refText, footnoteText });
                break;
            }

            case window.Types.BlockType.TOC: {
                const title = document.getElementById('edit-toc-title').value;
                this.updateBlock(block.id, { title });
                break;
            }

            case window.Types.BlockType.CROSS_REF: {
                const targetType = document.getElementById('edit-ref-target-type').value;
                const targetSelect = document.getElementById('edit-ref-target-id');
                const targetId = targetSelect.value;
                const selectedOption = targetSelect.options[targetSelect.selectedIndex];
                const finalTargetType = selectedOption && selectedOption.dataset.type ? selectedOption.dataset.type : targetType;
                this.updateBlock(block.id, { targetId, targetType: finalTargetType });
                break;
            }
        }

        this.closeModal();
    }

    _parseMarkdownSyntax(text) {
        const styles = [];
        let result = '';
        let i = 0;
        let footnoteIdCounter = 0;

        while (i < text.length) {
            if (i < text.length - 1 && text[i] === '*' && text[i + 1] === '*') {
                const endIdx = text.indexOf('**', i + 2);
                if (endIdx > 0) {
                    const boldText = text.substring(i + 2, endIdx);
                    const start = result.length;
                    result += boldText;
                    styles.push(new window.Types.InlineStyle(
                        window.Types.InlineStyleType.BOLD,
                        start,
                        result.length
                    ));
                    i = endIdx + 2;
                    continue;
                }
            }

            if (text[i] === '*') {
                const endIdx = text.indexOf('*', i + 1);
                if (endIdx > 0 && (endIdx === i + 1 || text[endIdx - 1] !== '*')) {
                    const italicText = text.substring(i + 1, endIdx);
                    const start = result.length;
                    result += italicText;
                    styles.push(new window.Types.InlineStyle(
                        window.Types.InlineStyleType.ITALIC,
                        start,
                        result.length
                    ));
                    i = endIdx + 1;
                    continue;
                }
            }

            if (i < text.length - 1 && text[i] === '[' && text[i + 1] === '!') {
                const endIdx = text.indexOf('!]', i + 2);
                if (endIdx > 0) {
                    const footnoteText = text.substring(i + 2, endIdx);
                    footnoteIdCounter++;
                    const footnoteId = `fn_auto_${Date.now()}_${footnoteIdCounter}`;
                    const start = result.length;
                    result += '¹';
                    styles.push(new window.Types.InlineStyle(
                        window.Types.InlineStyleType.FOOTNOTE_REF,
                        start,
                        result.length,
                        { footnoteId, footnoteText }
                    ));
                    i = endIdx + 2;
                    continue;
                }
            }

            result += text[i];
            i++;
        }

        return { text: result, styles };
    }

    _notifyChange() {
        if (this.onChange) {
            this.onChange(this.blocks);
        }
    }
}

if (typeof window !== 'undefined') {
    window.ContentEditor = ContentEditor;
}
