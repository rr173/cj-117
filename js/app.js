class Application {
    constructor() {
        this.editor = null;
        this.paginator = null;
        this.preview = null;
        this.exporter = null;
        this.documentProcessor = null;
        this.layoutParams = new window.Types.LayoutParams();
        this.debounceTimer = null;
        this._init();
    }

    _init() {
        this.editor = new window.ContentEditor('blocks-list');
        this.paginator = new window.Paginator.PaginationEngine();
        this.preview = new window.PreviewRenderer('preview-container');
        this.exporter = new window.HtmlExporter();
        this.documentProcessor = new window.DocumentProcessor();

        this._loadSampleContent();
        this._bindEditorEvents();
        this._bindParamEvents();
        this._bindExportEvents();
        this._bindZoomEvents();
        this._bindDocTitleEvents();

        this._updateLayout();
    }

    _loadSampleContent() {
        const tempEditor = new window.ContentEditor('blocks-list');
        const p = (rawText) => {
            const parsed = tempEditor._parseMarkdownSyntax(rawText);
            return new window.Types.ContentBlock(window.Types.BlockType.PARAGRAPH, {
                text: parsed.text,
                inlineStyles: parsed.styles
            });
        };

        const h1 = new window.Types.ContentBlock(window.Types.BlockType.H1, {
            text: '交互式排版引擎使用说明'
        });

        const tocBlock = new window.Types.ContentBlock(window.Types.BlockType.TOC, {
            title: '目录'
        });

        const introH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '一、内容编辑'
        });

        const editH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '1.1 内容块类型'
        });

        const refCrossHeading = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '二、自动编号与引用'
        });

        const headingNumH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '2.1 标题自动编号'
        });

        const figureNumH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '2.2 图表编号'
        });

        const crossRefH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '2.3 交叉引用'
        });

        const layoutH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '三、排版参数'
        });

        const imageBlock = new window.Types.ContentBlock(window.Types.BlockType.IMAGE, {
            aspectRatio: '16:9',
            caption: '系统架构示意图',
            altText: '系统架构图占位'
        });

        const breakH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '四、断行与分页'
        });

        const breakH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '4.1 分页示例'
        });

        const tableH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '五、表格示例'
        });

        const tableBlock = new window.Types.ContentBlock(window.Types.BlockType.TABLE, {
            columns: 4,
            headers: ['功能模块', '主要特性', '实现方式', '状态'],
            rows: [
                ['断行引擎', '最小不齐度算法', '动态规划DP', '已完成'],
                ['分页引擎', '孤行寡行控制', '预计算+回溯', '已完成'],
                ['图片排版', '浮动+整体移动', '尺寸估算', '已完成'],
                ['表格排版', '跨页拆分+表头重复', '行高计算', '已完成'],
                ['脚注排版', '页底分配+续排', '区域预留', '已完成'],
                ['目录生成', '自动扫描+页码计算', '两阶段分页', '已完成'],
                ['交叉引用', '动态编号+失效检测', '引用追踪', '已完成'],
                ['预览渲染', 'DOM绝对定位', '逐页构建', '已完成'],
                ['HTML导出', '打印样式', '@page规则', '已完成']
            ]
        });

        const previewH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '六、预览与导出'
        });

        const blocks = [
            h1,
            tocBlock,
            introH2,
            p('在左侧面板，您可以添加各种类型的内容块：标题（H1-H3）、正文段落（支持**加粗**和*斜体*）、图片占位、表格、脚注引用、目录和交叉引用。每个内容块可以通过拖拽调整顺序，或使用操作按钮进行编辑、复制和删除。'),
            editH3,
            p('标题有三个层级：H1、H2和H3，系统会按照层级自动为它们编号（如1、1.1、1.1.1）。您也可以在右侧参数面板关闭自动编号功能。'),
            refCrossHeading,
            headingNumH3,
            p('标题自动编号功能会按照标题在文档中出现的顺序和层级自动生成编号。H1一级标题用"1、2、3"，H2二级标题用"1.1、1.2"，H3三级标题用"1.1.1、1.1.2"。编号会自动显示在标题文字前面，目录中也会同步显示。'),
            figureNumH3,
            p('图片和表格各自维护独立的编号序列。例如：'),
            imageBlock,
            p('上面这张图片会自动编号为图1。如果在它之前插入新的图片，所有后续图片的编号会自动更新。表格同理，按照出现顺序编号为表1、表2……表格的编号显示在表格上方居中，图片的编号显示在图片下方居中。'),
            crossRefH3,
            p('交叉引用功能允许您在正文中引用其他位置的标题、图片或表格。引用标记会自动显示目标的编号和所在页码。例如：'),
            p('您可以查看'),
            new window.Types.ContentBlock(window.Types.BlockType.CROSS_REF, {
                targetId: imageBlock.id,
                targetType: window.Types.CrossRefTargetType.IMAGE
            }),
            p('了解系统架构，或参考'),
            new window.Types.ContentBlock(window.Types.BlockType.CROSS_REF, {
                targetId: tableBlock.id,
                targetType: window.Types.CrossRefTargetType.TABLE
            }),
            p('查看功能清单。关于排版算法的详细说明，请见'),
            new window.Types.ContentBlock(window.Types.BlockType.CROSS_REF, {
                targetId: breakH2.id,
                targetType: window.Types.CrossRefTargetType.HEADING
            }),
            p('。当您调整内容顺序、增删标题或图表时，所有交叉引用的编号和页码会自动更新。如果引用的目标被删除，引用标记会显示为红色的"引用失效"警告。'),
            layoutH2,
            p('右侧面板提供了丰富的排版参数配置：纸张尺寸（默认A4纵向210×297mm）、上下左右边距（默认各20mm）、正文字号（默认12pt）、行间距（默认1.5倍）、段间距（默认0.5倍行高）、页眉页脚的显示开关，以及标题自动编号开关。所有参数修改后都会立即触发重新排版。'),
            breakH2,
            p('本引擎采用动态规划算法实现最小不齐度断行，通过最小化每行末尾空白量的平方和，产生视觉上更均匀的右边距。中文按字断行，英文按单词断行，超长单词会自动添加连字符。分页规则包含：标题后至少跟随2行正文、防止寡行和孤行、图片整体移动、长表格跨页拆分并重复表头。'),
            breakH3,
            p('这里插入一些测试文本以演示分页效果。为了展示脚注功能，我们在这里[!这是一个示例脚注，用于说明脚注排版功能。脚注会出现在当页底部，并有分隔线与正文区分。如果脚注内容很长，系统会自动将其续排到下一页。!]添加一个脚注引用。更多的内容会让分页效果更加明显，包括孤行寡行控制、图片浮动排版等高级特性。通过调整参数，您可以看到排版引擎如何智能地处理各种复杂的排版场景。分页并不是简单的内容截断，而是经过精心计算的优化结果。'),
            tableH2,
            tableBlock,
            previewH2,
            p('中间预览面板支持50%-200%的缩放浏览，当前编辑的内容块会在预览中自动高亮显示并滚动到对应位置。点击右上角的"导出HTML"按钮，可以生成一个自包含的HTML文件，使用CSS @page规则和print media query保持与预览一致的分页效果。导出的HTML文件中：'),
            p('• 目录条目是可点击的锚点链接，点击可跳转到对应标题位置；'),
            p('• 图表编号和交叉引用会变成静态文本，数值与导出时保持一致。'),
            new window.Types.ContentBlock(window.Types.BlockType.H2, {
                text: '七、脚注说明'
            }),
            new window.Types.ContentBlock(window.Types.BlockType.FOOTNOTE_REF, {
                refText: '关于脚注的编号规则，这里做一个补充说明',
                footnoteText: '脚注编号是全文连续递增的，不受分页影响。每个脚注引用都会获得一个唯一的编号，对应的脚注文本会排在引用所在页的底部区域，从页面底边距上方往上排列。脚注区域和正文之间有一条细分隔线。如果脚注文本本身很长，允许续排到下一页底部，但在当页至少要显示脚注的前两行。'
            }),
            p('感谢使用本排版工具！如有任何问题或建议，欢迎反馈。本工具演示了现代排版引擎的核心技术原理，包括专业断行、智能分页、图文混排、脚注处理、**自动目录生成**、*图表自动编号*和交叉引用等功能，希望能对您的工作有所帮助。')
        ];

        this.editor.setBlocks(blocks);
    }

    _bindEditorEvents() {
        this.editor.onChange = (blocks) => {
            this._debounceUpdate();
        };

        this.editor.onSelect = (blockId) => {
            this.preview.setSelectedBlockId(blockId);
        };
    }

    _bindParamEvents() {
        const paramInputs = [
            { id: 'page-width', key: 'pageWidthMm', type: 'number' },
            { id: 'page-height', key: 'pageHeightMm', type: 'number' },
            { id: 'margin-top', key: 'marginTopMm', type: 'number' },
            { id: 'margin-bottom', key: 'marginBottomMm', type: 'number' },
            { id: 'margin-left', key: 'marginLeftMm', type: 'number' },
            { id: 'margin-right', key: 'marginRightMm', type: 'number' },
            { id: 'font-size', key: 'fontSizePt', type: 'number' },
            { id: 'line-height', key: 'lineHeight', type: 'number' },
            { id: 'paragraph-spacing', key: 'paragraphSpacing', type: 'number' },
            { id: 'font-family', key: 'fontFamily', type: 'string' }
        ];

        paramInputs.forEach(({ id, key, type }) => {
            const el = document.getElementById(id);
            if (!el) return;

            const handler = () => {
                let value = el.value;
                if (type === 'number') {
                    value = parseFloat(value);
                    if (isNaN(value)) return;
                }
                this.layoutParams[key] = value;
                this._debounceUpdate();
            };

            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });

        document.getElementById('show-header').addEventListener('change', (e) => {
            this.layoutParams.showHeader = e.target.checked;
            this._debounceUpdate();
        });

        document.getElementById('show-page-number').addEventListener('change', (e) => {
            this.layoutParams.showPageNumber = e.target.checked;
            this._debounceUpdate();
        });

        document.getElementById('auto-number-heading').addEventListener('change', (e) => {
            this.layoutParams.autoNumberHeading = e.target.checked;
            this._debounceUpdate();
        });

        document.getElementById('paper-preset').addEventListener('change', (e) => {
            const preset = e.target.value;
            if (preset !== 'custom' && window.Types.PaperPresets[preset]) {
                const { width, height } = window.Types.PaperPresets[preset];
                this.layoutParams.pageWidthMm = width;
                this.layoutParams.pageHeightMm = height;
                document.getElementById('page-width').value = width;
                document.getElementById('page-height').value = height;
                this._debounceUpdate();
            }
        });

        const customInputs = ['page-width', 'page-height'];
        customInputs.forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                document.getElementById('paper-preset').value = 'custom';
            });
        });
    }

    _bindExportEvents() {
        document.getElementById('btn-export').addEventListener('click', () => {
            this._exportHtml();
        });
    }

    _bindZoomEvents() {
        const zoomSelect = document.getElementById('zoom-select');
        zoomSelect.addEventListener('change', (e) => {
            const zoom = parseFloat(e.target.value);
            this.preview.setZoom(zoom);
        });
    }

    _bindDocTitleEvents() {
        const docTitleInput = document.getElementById('doc-title');
        docTitleInput.addEventListener('input', (e) => {
            const title = e.target.value;
            this.preview.setDocTitle(title);
            this._debounceUpdate();
        });
    }

    _debounceUpdate() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this._updateLayout();
        }, 150);
    }

    _updateLayout() {
        const blocks = this.editor.getBlocks();
        const docTitle = document.getElementById('doc-title').value;

        this.documentProcessor.setParams(this.layoutParams);
        this.documentProcessor.setBlocks(blocks);
        this.documentProcessor.process();

        this.paginator.setParams(this.layoutParams);
        this.paginator.setBlocks(blocks);
        this.paginator.setDocumentProcessor(this.documentProcessor);

        const pages = this.paginator.paginate();

        this.documentProcessor.updatePageIndices(pages);

        let pageNumberOffset = 0;
        if (this.documentProcessor.tocBlockId) {
            for (let i = 0; i < pages.length; i++) {
                const hasToc = pages[i].pieces.some(p => p.blockId === this.documentProcessor.tocBlockId);
                if (hasToc) {
                    pageNumberOffset = i + 1;
                }
            }
            if (pageNumberOffset > 0) {
                let hasBodyAfterToc = false;
                for (let i = pageNumberOffset; i < pages.length; i++) {
                    const hasHeading = pages[i].pieces.some(p =>
                        p.type === window.Types.BlockType.H1 ||
                        p.type === window.Types.BlockType.H2 ||
                        p.type === window.Types.BlockType.H3
                    );
                    if (hasHeading) {
                        hasBodyAfterToc = true;
                        pageNumberOffset = i;
                        break;
                    }
                }
                if (!hasBodyAfterToc) {
                    pageNumberOffset = 0;
                }
            }
        }
        this.documentProcessor.setPageNumberOffset(pageNumberOffset);

        this.preview.setParams(this.layoutParams);
        this.preview.setPages(pages);
        this.preview.setDocTitle(docTitle);
        this.preview.setDocumentProcessor(this.documentProcessor);
        this.preview.setPageNumberOffset(pageNumberOffset);
        this.preview.setSelectedBlockId(this.editor.getSelectedBlockId());
        this.preview.render();

        this.exporter.setData(pages, this.layoutParams, docTitle);
        this.exporter.setDocumentProcessor(this.documentProcessor);
        this.exporter.setPageNumberOffset(pageNumberOffset);
    }

    _exportHtml() {
        const docTitle = document.getElementById('doc-title').value;
        const blocks = this.editor.getBlocks();

        this.documentProcessor.setParams(this.layoutParams);
        this.documentProcessor.setBlocks(blocks);
        this.documentProcessor.process();

        this.paginator.setParams(this.layoutParams);
        this.paginator.setBlocks(blocks);
        this.paginator.setDocumentProcessor(this.documentProcessor);

        const pages = this.paginator.paginate();
        this.documentProcessor.updatePageIndices(pages);

        let pageNumberOffset = 0;
        if (this.documentProcessor.tocBlockId) {
            for (let i = 0; i < pages.length; i++) {
                const hasToc = pages[i].pieces.some(p => p.blockId === this.documentProcessor.tocBlockId);
                if (hasToc) {
                    pageNumberOffset = i + 1;
                }
            }
            if (pageNumberOffset > 0) {
                let hasBodyAfterToc = false;
                for (let i = pageNumberOffset; i < pages.length; i++) {
                    const hasHeading = pages[i].pieces.some(p =>
                        p.type === window.Types.BlockType.H1 ||
                        p.type === window.Types.BlockType.H2 ||
                        p.type === window.Types.BlockType.H3
                    );
                    if (hasHeading) {
                        hasBodyAfterToc = true;
                        pageNumberOffset = i;
                        break;
                    }
                }
                if (!hasBodyAfterToc) {
                    pageNumberOffset = 0;
                }
            }
        }
        this.documentProcessor.setPageNumberOffset(pageNumberOffset);

        this.exporter.setData(pages, this.layoutParams, docTitle);
        this.exporter.setDocumentProcessor(this.documentProcessor);
        this.exporter.setPageNumberOffset(pageNumberOffset);
        this.exporter.exportToHtml();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new Application();
});
