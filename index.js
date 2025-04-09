// siyuan-plugin-simple-search-plus v1.0.0
const siyuan = require("siyuan");

function mylog(...args) {
    return
    const err = new Error();
    // 获取堆栈信息
    const stack = err.stack.split('\n');
    const location = stack[2] || "unknown location";
    
    // 解析函数名、文件名和行号
    const parts = location.trim().split(' ');
    const functionName = parts[1] || "unknown function";
    const fileInfo = decodeURIComponent(parts[2]?.replace(/\s*\(\s*|\s*:\d+\)\s*/g, '')); // 去掉小括号中的内容
    
    // 获取当前时间
    const now = new Date();
    // 获取时间部分
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

    // 构造日志前缀
    // const logPrefix = `[${hours}:${minutes}:${seconds}:${milliseconds}] [${functionName} ${fileInfo}]`;
    const logPrefix = `[${functionName} ${fileInfo}]`;

    console.log(`${logPrefix} `, ...args);
}

const SQL_FLAG = '("simple_search_flag"="simple_search_flag")'

const simple_search_css = document.createElement('style');
simple_search_css.textContent = `
    #searchInput, 
    #searchSyntaxCheck {
        display: none
    }
`;

const sql_default_order_by = "order by case type \
 when 'd' then 1\
 when 'h' then 2\
 when 'i' then 3\
 when 'p' then 4\
 when 't' then 5\
 when 'b' then 6\
 when 'c' then 7\
 when 'm' then 8\
 when 'l' then 9\
 when 's' then 10\
 when 'html' then 11\
 when 'widget' then 12\
 when 'query_embed' then 13\
 when 'iframe' then 14\
 end, box ASC, hpath ASC, updated desc";
const type_order = {
    "d": " when 'd' then ",
    "h": " when 'h' then ",
    "i": " when 'i' then ",
    "p": " when 'p' then ",
    "t": " when 't' then ",
    "b": " when 'b' then ",
    "c": " when 'c' then ",
    "m": " when 'm' then ",
    "l": " when 'l' then ",
    "s": " when 's' then ",
}
const type_mapping = { // 定义思源块类型映射关系
    audioBlock: '',
    blockquote: 'b',
    codeBlock: 'c',
    databaseBlock: '',
    document: 'd',
    embedBlock: '',
    heading: 'h',
    htmlBlock: '',
    iframeBlock: '',
    list: 'l',
    listItem: 'i',
    mathBlock: 'm',
    paragraph: 'p',
    superBlock: 's',
    table: 't',
    videoBlock: '',
    widgetBlock: ''
};


let g_keywords = []; // 存储搜索的关键词, 用于搜索结果高亮
let g_id_path = [];
function translateSearchInput(search_keywords) {
    if (search_keywords.length < 2 || search_keywords.match("^-[wqrs]") != null) {
        return search_keywords;
    }
    // 解析分类输入内容
    let input_text_items            = search_keywords.split(" ");
    let key_words                   = [];                          // 搜索关键词
    let excluded_key_words          = [];                          // 排除的关键词
    let options                     = "";                          // 搜索选项
    let if_options_exist            = false;
    let if_excluded_key_words_exist = false;
    for (let i = 0; i < input_text_items.length; i++) {
        if (input_text_items[i] == "" || input_text_items[i] == "-") {
            continue;
        } else if (input_text_items[i].match(/^-([akKedlptbsicmoOL]|h[1-6]*)+$/) != null) { // kK为当前文档搜索，e为扩展搜索，其他为块类型
            // 以'-'开头, 后序全是搜索选项
            options += input_text_items[i].substring(1, input_text_items[i].length);
            if_options_exist = true;
        }
        else if (input_text_items[i].match(/^-.+/) != null) {
            // 以 '-' 开头, 后序有不是搜索选项的字符, 判定为 排除关键词
            excluded_key_words.push(input_text_items[i].substring(1, input_text_items[i].length));
            if_excluded_key_words_exist = true;
        }
        else {
            // 搜索的关键词
            key_words.push(input_text_items[i]);
        }
    }
    g_keywords = key_words;
    if ((!if_options_exist) && (!if_excluded_key_words_exist)) {
        mylog('-w');
        return "-w" + search_keywords; // 仅有关键词时使用关键词查询
    } else if ((!if_options_exist) && (if_excluded_key_words_exist)) {
        let query_syntax = "-q";  // 仅有关键词和排除关键词是使用查询语法查询
        for (let i = 0; i < key_words.length; i++) {
            query_syntax += " " + key_words[i];
        }
        for (let i = 0; i < excluded_key_words.length; i++) {
            query_syntax += " NOT " + excluded_key_words[i];
        }
        mylog('-q');
        return query_syntax;
    }
    // 判断是否扩展范围搜索，若是则直接返回扩展范围搜索的sql语句
    if (options.match(/e/) != null) {
        let sql_extended_search = "select path from blocks where type ='d' ";
        let sql_content_like = "";
        for (let i = 0; i < key_words.length; i++) {
            sql_extended_search += "and path in (select path from blocks where content like '%" + key_words[i] + "%') ";
            sql_content_like += "content like '%" + key_words[i] + "%' or ";
        }
        for (let i = 0; i < excluded_key_words.length; i++) {
            sql_extended_search += "and path not in (select path from blocks where content like '%" + excluded_key_words[i] + "%') ";
        }
        mylog('-es');
        return "-s" + 'select * from blocks where ' + SQL_FLAG + ' and path in (' +
            sql_extended_search + ") and (" + sql_content_like.slice(0, -4) + ") and type not rlike '^[libs]$' " + // l i b s块类型不是叶子节点，重复
            sql_default_order_by;
    }

    // 一般搜索模式
    // sql_prefix 首部分
    let sql_prefix = 'select * from blocks where ' + SQL_FLAG + ' and ';
    // sql_key_words 过滤 关键词
    let sql_key_words = "";
    if (key_words.length != 0) {
        sql_key_words += "content like '%" + key_words[0] + "%' ";
        for (let i = 1; i < key_words.length; i++) {
            sql_key_words += "and content like '%" + key_words[i] + "%' ";
        }
    }
    for (let i = 0; i < excluded_key_words.length; i++) {
        sql_key_words += "and content not like '%" + excluded_key_words[i] + "%' ";
    }
    if (sql_key_words != "") {
        sql_key_words = "(" + sql_key_words + ") ";
    } else {
        return "-w"
    }
    // sql 是否在当前文档搜索
    let sql_current_doc = "";
    if (options.match(/[kK]/) != null) {  // 当前文档或带子文档搜索
        let current_doc_id = document.querySelector(".fn__flex-1.protyle:not(.fn__none)").childNodes[1].childNodes[0].childNodes[0].getAttribute("data-node-id");
        sql_current_doc = options.match(/k/) ? `and path like '%${current_doc_id}.sy' ` // 在当前文档搜索
                                             : `and path rlike '${current_doc_id}' `;   // 在当前文档及子文档搜索
        options = options.replace(/[kK]/g, "");
    }
    else if (options.match(/[a]/) != null) {
        options = options.replace(/[a]/g, "");
    }
    else if (g_id_path.length) {
        // 如果没有指定全部文档 && 指定了路径, 就使用指定的路径
        let filter_path = ""
        g_id_path.forEach(path => {
            let filter_one = ""
            let box_path = ""
            let file_path = ""
            // 找到第一个 '/' 的索引
            const idx = path.indexOf('/');
            if (idx == -1) {
                box_path = path;
                filter_one = `(box="${box_path}")`
            }
            else {
                box_path = path.substring(0, idx);
                file_path = path.substring(idx);
                filter_one = `(box="${box_path}" and path like '${file_path}%')`
            }
            filter_path = filter_path + filter_one + " or ";
        })
        if (filter_path.length) {
            sql_current_doc = `and (${filter_path.slice(0, -3)}) `
        }
    }
    // sql_type_rlike 过滤 块类型
    let sql_types      = options;
    let sql_type_rlike = ""; // sql筛选块的语句
    const type_handler = {
        // 搜索标准块类型的sql语句
        "[dlptbsicm]": (types) => `type rlike '^[${types.replace(/[^dlptbsicm]/g, "")}]$' `,
        // 搜索子标题的sql语句
        "h[1-6]*": (types) => {
            const head_type = `type rlike '^[h]$' `
            const sub_type = types.replace(/[^\d]/g, "")
            if (sub_type != '') {
                const sub_str = `subtype rlike '^h[${sub_type}]$' `
                return `(${head_type} and ${sub_str}) `
            }
            return head_type;
        },
        // 搜索待办的sql语句
        "[oO]": (types) => {
            let todoType = !types.includes('O') ? "and markdown like '%[ ] %'" // o：仅搜索未完成待办
                         : !types.includes('o') ? "and markdown like '%[x] %'" // O：仅搜索已完成待办
                         : "and (markdown like '%[ ] %' or markdown like '%[x] %')"; // oO：搜索所有待办
            return `(subtype like 't' and type not like 'l' ${todoType}) `;
        },
        // 搜索带链接的块的sql语句
        "[L]": () => `(type rlike '^[htp]$' and markdown like '%[%](%)%') `
    };
    for (let key in type_handler) {
        if (sql_types.match(key)) {
            if (sql_type_rlike != "") sql_type_rlike += "or ";
            sql_type_rlike += type_handler[key](sql_types);
        }
    }
    if (sql_type_rlike == "") { // 未指定搜索块类型时，选择“搜索类型”中开启的块类型
        let types = "";
        let search_types = window.siyuan.storage['local-searchdata'].types;
        for (const key in search_types) {
            if (search_types[key]) types += type_mapping[key];
        }
        sql_type_rlike = `type rlike '^[${types}]$' `;
    }
    sql_type_rlike = "and (" + sql_type_rlike + ") ";
    sql_types = sql_types.replace(/[oOL1-6]/g, "");
    // sql 排序
    let sql_order_by = "order by case type";
    if (sql_types != "") {
        for (let i = 0; i < sql_types.length; i++) {
            sql_order_by += type_order[sql_types[i]] + i.toString();
        }
        sql_order_by += " end, box ASC, hpath ASC, updated desc";
    } else {
        sql_order_by = sql_default_order_by;
    }

    // 完整sql语句
    return "-s" + sql_prefix + sql_key_words + sql_type_rlike + sql_current_doc + sql_order_by;
}



let g_last_search_method = -1;
function switchSearchMethod(i) {
    if (g_last_search_method != i) {
        const type_btn = document.querySelector("#searchSyntaxCheck");
        type_btn.click();
        const type_ele = document.querySelector("#commonMenu").lastChild.children[i];
        if (!type_ele.classList.contains('b3-menu__item--selected')) {
            type_ele.click()
        }
        else {
            type_btn.click();
        }
        g_last_search_method = i;
    }
}

let g_changed_user_groupby = false;      // 记录是否切换过分组
function changeGroupBy(i){               // i = 0 默认分组，i = 1 按文档分组
    if (i == 0 && g_changed_user_groupby && window.siyuan.storage['local-searchdata'].group == 0) {         // 若分组被切换过，且默认不分组，则切换不分组
        document.getElementById("searchMore").click();
        document.querySelector("#commonMenu").lastChild.children[1].children[2].firstChild.firstChild.click();
        g_changed_user_groupby = false;
    } else if (i == 1 && !g_changed_user_groupby && window.siyuan.storage['local-searchdata'].group == 0) { // 若分组没切换过，且默认不分组，则按文档分组
        document.getElementById("searchMore").click();
        document.querySelector("#commonMenu").lastChild.children[1].children[2].firstChild.lastChild.click();
        g_changed_user_groupby = true;
    }
}

function highlightKeywords(search_list_text_nodes, keyword, highlight_type) {
    const str = keyword.trim().toLowerCase();
    const ranges = search_list_text_nodes // 查找所有文本节点是否包含搜索词
        .map((el) => {
            const text = el.textContent.toLowerCase();
            const indices = [];
            let startPos = 0;
            while (startPos < text.length) {
                const index = text.indexOf(str, startPos);
                if (index === -1) break;
                indices.push(index);
                startPos = index + str.length;
            }
            return indices.map((index) => {
                const range = document.createRange();
                range.setStart(el, index);
                range.setEnd(el, index + str.length);
                return range;
            });
        });
    const searchResultsHighlight = new Highlight(...ranges.flat()); // 创建高亮对象
    CSS.highlights.set(highlight_type, searchResultsHighlight);     // 注册高亮
}

let g_observer;
let g_search_keywords = "";
let g_highlight_keywords = false;
let g_input_event_func = null;
class SimpleSearch extends siyuan.Plugin {
    // 搜索事件触发
    inputSearchEvent(cfg) {
        mylog('搜索事件触发', cfg)
        if (/^#.*#$/.test(document.getElementById("searchInput")?.value)  // 多次点击标签搜索时更新搜索框关键词
            && document.getElementById("searchInput").value != document.getElementById("simpleSearchInput").value) {
            document.getElementById("simpleSearchInput").value = document.getElementById("searchInput").value;
            document.getElementById("simpleSearchInput").focus();  // 聚焦到输入框
            document.getElementById("simpleSearchInput").select(); // 选择框内内容
            g_search_keywords = document.getElementById("searchInput").value;
        }
        // 保存关键词，确保思源搜索关键词为输入的关键词，而不是翻译后的sql语句
        mylog('保存搜索关键词: ', g_search_keywords)
        window.siyuan.storage["local-searchdata"].k = g_search_keywords;

        // 修改指定路径
        let re_input_flag = false;
        if (cfg?.detail?.config?.idPath && JSON.stringify(g_id_path) !== JSON.stringify(cfg.detail.config.idPath)) {
            mylog('修改指定路径: ', JSON.stringify(g_id_path), JSON.stringify(cfg.detail.config.idPath))
            g_id_path = cfg.detail.config.idPath
            re_input_flag = true;
        }
        if (cfg?.detail?.config && cfg.detail.config.method != g_last_search_method) {
            const method_tmp = g_last_search_method;
            mylog('修改搜索方式', cfg.detail.config.method, method_tmp)
            g_last_search_method = -1;
            switchSearchMethod(method_tmp)
        }
        
        // 点击了历史记录
        let search_str = document.getElementById("searchInput")?.value;
        let new_search = document.getElementById("simpleSearchInput")
        if (search_str && window.siyuan.storage["local-searchkeys"].keys.indexOf(search_str) != -1 && search_str != new_search.value) {
            re_input_flag = true;
            new_search.value = search_str
        }
        // 重新搜索
        if (re_input_flag && g_input_event_func) g_input_event_func()
    }
    // 在界面加载完毕后高亮关键词
    loadedProtyleStaticEvent() {    
        CSS.highlights.clear();     // 清除上个高亮
        if (g_highlight_keywords) { // 判断是否需要高亮关键词
            const search_list = document.getElementById("searchList"); // 搜索结果列表的节点
            if(search_list == null) return;                            // 判断是否存在搜索界面
            const search_list_text_nodes = Array.from(search_list.querySelectorAll(".b3-list-item__text:not(.ariaLabel)"), el => el.firstChild); // 获取所有具有 b3-list-item__text 类的节点的文本子节点
            g_keywords.forEach((keyword) => {
                highlightKeywords(search_list_text_nodes, keyword, "highlight-keywords-search-list");
            });
            const search_preview = document.getElementById("searchPreview").children[1].children[0]; // 搜索预览内容的节点
            const tree_walker = document.createTreeWalker(search_preview, NodeFilter.SHOW_TEXT);     // 创建 createTreeWalker 迭代器，用于遍历文本节点，保存到一个数组
            const search_preview_text_nodes = [];
            let current_node = tree_walker.nextNode();
            while (current_node) {
                if (current_node.textContent.trim().length > 1) {
                    search_preview_text_nodes.push(current_node);
                }
                current_node = tree_walker.nextNode();
            }
            g_keywords.forEach((keyword) => {
                highlightKeywords(search_preview_text_nodes, keyword, "highlight-keywords-search-preview");
            });
        }
    }
    // 布局初始化完成后, 触发
    onLayoutReady() {
        // 增加显示
        const add_display_input_sw = function () {
            let icon = 'iconEye';
            let icon_label = '点击显示/隐藏原搜索框';
            if (document.body.contains(simple_search_css)) {
                icon = 'iconEyeoff';
            }
            // 获取 id 为 searchFilter 的元素
            const searchFilterElement = document.getElementById("searchFilter");
            if (!searchFilterElement) return;
            // 使用 insertAdjacentHTML 在元素前面插入 HTML
            searchFilterElement.insertAdjacentHTML('beforebegin', `
                <span id="simpleSearchDisplayInputSw" aria-label="${icon_label}" class="block__icon ariaLabel">
                    <svg><use xlink:href="#${icon}"></use></svg>
                </span>
                <span class="fn__space"></span>
            `);
            
            // 增加点击回调
            const displayInputSwElement = document.getElementById("simpleSearchDisplayInputSw");
            if (!displayInputSwElement) return;
            const useElement = displayInputSwElement.querySelector('svg>use')
            displayInputSwElement.addEventListener('click', function() {
                if (document.body.contains(simple_search_css)) {
                    mylog('显示原搜索框')
                    simple_search_css.remove();
                    useElement.setAttribute('xlink:href', '#iconEye');
                }
                else {
                    mylog('隐藏原搜索框')
                    document.body.appendChild(simple_search_css);
                    useElement.setAttribute('xlink:href', '#iconEyeoff');
                }
            });

        }

        // 当观察到变动时执行的回调函数
        // 即当搜索界面打开时，插入新搜索框，隐藏原搜索框，然后将新搜索框内容转成sql后填入原搜索框
        const operationsAfterOpenSearch = function () {
            g_last_search_method = -1; // 每次打开搜索都要设置搜索方法
            // 插入新搜索框，隐藏原搜索框
            // 原搜索框
            let originalSearchInput = document.getElementById("searchInput");
            // 新搜索框
            let simpleSearchInput = originalSearchInput.cloneNode();
            simpleSearchInput.id = "simpleSearchInput";
            simpleSearchInput.value = "";
            originalSearchInput.after(simpleSearchInput);
            // originalSearchInput.style = "width: 0; position: fixed; visibility: hidden;";

            // 设置清空按钮
            simpleSearchInput.nextSibling.onclick = function () {
                simpleSearchInput.value = "";
                simpleSearchInput.focus();
            }
            simpleSearchInput.nextSibling.style.height = '42px';


            // 新搜索框 输入 触发
            const input_event_func = function () {
                g_highlight_keywords = false;
                // 获取输入内容
                g_search_keywords = simpleSearchInput.value;
                const src_input_str = originalSearchInput.value;
                if (g_search_keywords.length < 2) {
                    // 输入较短的内容, 使用原功能
                    switchSearchMethod(0);
                    originalSearchInput.value = g_search_keywords;
                } else {
                    // 先转换内容
                    let input_translated = translateSearchInput(g_search_keywords);
                    mylog('原搜索内容', g_search_keywords);
                    mylog('转换后内容', input_translated);
                    // 选择原搜索类型
                    switch (input_translated.substring(0, 2)) {
                        case "-w": switchSearchMethod(0); break;
                        case "-q": switchSearchMethod(1); break;
                        case "-s": switchSearchMethod(2); break;
                        case "-r": switchSearchMethod(3); break;
                    }
                    // 
                    originalSearchInput.value = input_translated.slice(2, input_translated.length);
                    if (input_translated.substring(0, 2) == "-s") {
                        g_highlight_keywords = true;
                        if (input_translated.match(/'\^\[libs\]\$'/g) != null) { // 若是扩展搜索，按文档分组
                            changeGroupBy(1);
                        } else { // 否则切换默认分组
                            changeGroupBy(0);
                        }
                    }
                }
                // 触发源搜索框开始搜索
                if (src_input_str != originalSearchInput.value) {
                originalSearchInput.dispatchEvent(new InputEvent("input"));
                }
            }
            // 获取搜索路径
            g_id_path = window.siyuan.storage['local-searchdata'].idPath
            g_input_event_func = input_event_func;


            // 清空查询条件
            setTimeout(() => {
                document.querySelector('button[data-type="removeCriterion"]').addEventListener('click', () => {
                    simpleSearchInput.value = "";
                    simpleSearchInput.focus();
                    g_last_search_method = 0;
                })
            }, 200)

            // 替换历史记录
            // 将保存的原搜索框的历史记录换成新搜索框的内容 且去重
            originalSearchInput.addEventListener("blur", (event) => {
                let his_list = window.siyuan.storage["local-searchkeys"].keys;
                const real_str = originalSearchInput.value
                const input_str = simpleSearchInput.value

                if (real_str.includes(SQL_FLAG)) {
                    // 有sql标记的, 换成 新搜索框的内容
                    const idx = his_list.indexOf(real_str);
                    if (idx != -1) {
                        if (input_str && input_str.length) {
                            his_list[idx] = input_str;
                            his_list = Array.from(new Set(his_list));
                        }
                        else {
                            his_list.splice(idx, 1);
                        }
                    }
                }
                his_list = his_list.filter(item => !item.includes(SQL_FLAG));
                window.siyuan.storage["local-searchkeys"].keys = his_list;
                // setStorageVal("local-searchkeys", window.siyuan.storage["local-searchkeys"])
                mylog('保存历史记录: ', window.siyuan.storage["local-searchkeys"].keys)
            })

            // 新搜索框按键触发, 绑定到原搜索框上
            const keyboard_event_func = function (event) {
                switch (event.keyCode) {
                    case 13:
                        originalSearchInput.dispatchEvent(new KeyboardEvent("keydown", { "keyCode": 13, "code": "KeyEnter", "key": "Enter" }));
                        break;
                    case 38:
                        originalSearchInput.dispatchEvent(new KeyboardEvent("keydown", { "keyCode": 38, "code": "KeyArrowUp", "key": "ArrowUp" }));
                        return false; // 禁用方向键原跳到行首功能
                    case 40:
                        originalSearchInput.dispatchEvent(new KeyboardEvent("keydown", { "keyCode": 40, "code": "KeyArrowDown", "key": "ArrowDown" }));
                        return false; // 禁用方向键原跳到行尾功能
                }
            }
            const input_blur_event_func = function () {
                originalSearchInput.dispatchEvent(new Event("blur")); // 触发原搜索框的 blur 事件
            }

            mylog(originalSearchInput.value)
            mylog(simpleSearchInput.value)
            simpleSearchInput.value = originalSearchInput.value; // 1、原搜索框关键词为保存的g_search_keywords  2、确保点击标签搜索时不被影响

            input_event_func();
            simpleSearchInput.focus();  // 聚焦到输入框
            simpleSearchInput.select(); // 选择框内内容

            // 当在输入框中按下按键的时候，将搜索框内容转成sql后填入原搜索框
            g_search_keywords = simpleSearchInput.value;
            simpleSearchInput.oninput = input_event_func; // 监听input事件
            simpleSearchInput.onkeydown = keyboard_event_func; // enter键打开搜索结果，上下键选择
            simpleSearchInput.onblur = input_blur_event_func; // 

            add_display_input_sw();
        }.bind(this);
        
        const createFileFunc = function () {
            const searchList = document.getElementById('searchList');
            if (!searchList) return;
            // 创建一个观察者实例
            const observer = new MutationObserver(async (mutationsList, observer) => {
                const searchNew = document.querySelector('#searchList>[data-type="search-new"]');
                if (!searchNew) return;
                // 加载时修改类型
                searchNew.dataset.type = 'simple-search-new-disabled';
                // 点击时恢复类型
                searchNew.addEventListener('click', function(event) {
                    searchNew.dataset.type = 'search-new';
                });
                searchNew.querySelector('.b3-list-item__meta').textContent = '点击创建';
                if(searchNew.nextElementSibling && searchNew.nextElementSibling.matches('.search__empty')) {
                    searchNew.nextElementSibling.textContent = `搜索结果为空，点击创建新文档`;
                    searchNew.nextElementSibling.addEventListener('click', function(event) {
                        searchNew.click();
                    });
                }
            });
            // 配置观察选项:
            const config = { childList: true };
            // 开始观察目标节点
            observer.observe(searchList, config);
            console.log('开始观察创建文档按钮')
            // 返回一个取消观察的方法
            return () => {
                observer.disconnect();
                console.log('取消观察创建文档节点')
            };
        }

        let cancelCreateFileFunc = null;
        const openSearchCallback = function (mutationsList) {
            for (let i = 0; i < mutationsList.length; i++) {
                if (mutationsList[i].removedNodes.length) {
                    if (mutationsList[i].removedNodes[0].getAttribute('data-key') == "dialog-globalsearch") {
                        window.siyuan.storage["local-searchdata"].k = g_search_keywords;
                        if (cancelCreateFileFunc) {
                            cancelCreateFileFunc();
                            cancelCreateFileFunc = null;
                        }
                        break;
                    }
                }
                
                if (mutationsList[i].addedNodes.length) {
                    if (mutationsList[i].addedNodes[0].getAttribute('data-key') == "dialog-globalsearch") {// 判断全局搜索
                        cancelCreateFileFunc = createFileFunc();
                        operationsAfterOpenSearch(); 
                        document.querySelector("#searchOpen").onclick = function () { // 确保按下在页签打开时搜索关键词不变
                            document.getElementById("searchInput").value = g_search_keywords;
                        }.bind(this);
                        break;
                    } else if (mutationsList[i].addedNodes[0].className == "fn__flex-1 fn__flex"  // 判断搜索页签
                    && mutationsList[i].addedNodes[0].innerText == "搜索") {
                        cancelCreateFileFunc = createFileFunc();
                        operationsAfterOpenSearch(); break;
                    }
                }
                
            }
        }.bind(this);

        this.eventBus.on("input-search", this.inputSearchEvent);
        this.eventBus.on("loaded-protyle-static", this.loadedProtyleStaticEvent);

        document.body.appendChild(simple_search_css);

        // 选择需要观察变动的节点
        const global_search_node = document.querySelector("body");
        const tab_search_node = document.querySelector(".layout__center");
        // 监视子节点的增减
        const observer_conf = { childList: true };
        // 创建一个观察器实例并传入回调函数
        g_observer = new MutationObserver(openSearchCallback);
        // 开始观察目标节点
        g_observer.observe(global_search_node, observer_conf);
        g_observer.observe(tab_search_node, observer_conf);
        console.log("simple search start...")
    }

    onunload() {
        // 停止观察目标节点
        g_observer.disconnect();
        simple_search_css.remove();
        this.eventBus.off("input-search", this.inputSearchEvent);
        this.eventBus.off("loaded-protyle-static", this.loadedProtyleStaticEvent);
        console.log("simple search stop...")
    }
};

module.exports = {
    default: SimpleSearch,
};