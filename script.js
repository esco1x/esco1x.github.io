let apiData = []; // global placeholder

async function init() {
    try {
        const res = await fetch("https://docs-api-dpdg.onrender.com/api/docs/all");
        if (!res.ok) throw new Error("Failed to fetch api data");
        apiData = await res.json();

        const sidebar = document.getElementById("sidebar");

        const scrollContainer = document.createElement("div");
        scrollContainer.className = "scrollable-content";
        sidebar.appendChild(scrollContainer);

        renderSidebar(apiData.data, scrollContainer);

        const homeDiv = document.createElement("div");
        homeDiv.id = "sidebar-home";
        homeDiv.innerHTML = `<a href="../" class="home-button">Home</a>`;
        sidebar.appendChild(homeDiv);
    } catch (err) {
        console.error("Error loading API data:", err);
        document.getElementById("content").innerHTML = "<h1>⚠️ Failed to load API data</h1>";
    }
}

init();

let folderHistory = [];

function renderSidebar(data, parent, level = 0, parentPath = "") {
    data.forEach(item => {
        const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;

        if (item.type === "file") {
            const li = document.createElement("li");
            li.textContent = "📄 " + item.name;
            li.dataset.path = currentPath;
            li.dataset.type = "file";

            li.addEventListener("click", () => {
                setActiveSidebar(currentPath);
                displayApi(item, currentPath);
            });

            li.style.paddingLeft = `${1.5 + level * 1.25}rem`;
            parent.appendChild(li);
        } else {
            const div = document.createElement("div");
            div.classList.add("category");
            div.dataset.level = level;

            const header = document.createElement("div");
            header.className = "category-header";
            header.textContent = "📁 " + item.name;
            header.dataset.path = currentPath;
            header.dataset.type = "folder";

            const items = document.createElement("ul");
            items.className = "category-items";
            items.dataset.path = currentPath;
            items.dataset.level = level + 1;
            items.style.display = "none";

            header.addEventListener("click", () => {
                setActiveSidebar(currentPath);
                displayFolder(item, currentPath);
                items.style.display = "block";
            });

            header.addEventListener("dblclick", () => {
                items.style.display = items.style.display === "block" ? "none" : "block";
            });

            div.appendChild(header);
            div.appendChild(items);
            parent.appendChild(div);

            if (item.children && item.children.length) {
                renderSidebar(item.children, items, level + 1, currentPath);
            }
        }
    });
}

function setActiveSidebar(path) {
    // Clear all highlights
    document.querySelectorAll(".category-header").forEach(header => {
        header.classList.remove("active-folder");
    });
    document.querySelectorAll("li[data-type='file']").forEach(file => {
        file.classList.remove("active-file");
    });
    document.querySelectorAll(".category-items").forEach(list => {
        list.style.display = "none";
    });

    const parts = path.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
        currentPath += (i > 0 ? "/" : "") + parts[i];

        const isLast = i === parts.length - 1;
        const header = document.querySelector(`.category-header[data-path="${currentPath}"]`);
        const list = document.querySelector(`.category-items[data-path="${currentPath}"]`);
        const file = document.querySelector(`li[data-path="${currentPath}"]`);

        if (isLast && file) {
            file.classList.add("active-file");
        } else if (isLast && header) {
            header.classList.add("active-folder");
        } else if (!isLast && header) {
            if (list) list.style.display = "block";
        }
    }

    if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join("/");
        const parentHeader = document.querySelector(`.category-header[data-path="${parentPath}"]`);
        if (parentHeader) {
            parentHeader.classList.add("active-folder");
        }
    }
}


function displayFolder(folder, folderPath) {
    if (folderHistory.length === 0 || folderHistory[folderHistory.length - 1] !== folderPath) {
        folderHistory.push(folderPath);
    }

    const content = document.getElementById("content");
    const canGoBack = folderPath.includes("/");

    content.innerHTML = `
        <h1>${folder.name}</h1>
        ${canGoBack ? `<button class="back-button">← Back</button>` : ""}
        <div class="folder-contents">
            ${folder.children && folder.children.length
            ? folder.children.map(child => {
                const childPath = `${folderPath}/${child.name}`;
                return `
                            <div class="folder-item" data-type="${child.type || "folder"}" data-path="${childPath}">
                                <span>${child.type === "file" ? "📄" : "📁"}</span>
                                <span class="folder-item-name">${child.name}</span>
                            </div>
                          `;
            }).join("")
            : "<p><em>This folder is empty.</em></p>"
        }
        </div>
    `;
    const backBtn = document.querySelector(".back-button");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            folderHistory.pop();
            const prevPath = folderHistory.pop();
            if (!prevPath) {
                document.getElementById("content").innerHTML = "<h1>API Documentation Home</h1>";
                setActiveSidebar("");
                return;
            }
            const parentItem = findItemByPath(prevPath);
            setActiveSidebar(prevPath);
            displayFolder(parentItem, prevPath);
        });
    }
    document.querySelectorAll(".folder-item").forEach(el => {
        el.addEventListener("click", () => {
            const path = el.dataset.path;
            const type = el.dataset.type;
            const item = findItemByPath(path);

            setActiveSidebar(path);

            if (type === "file") {
                displayApi(item, path);
            } else {
                displayFolder(item, path);
            }
        });
    });
}

function highlightJSON(code) {
    code = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tokenRegex = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(\.\d+)?([eE][+-]?\d+)?\b|[{}\[\],:]/g;

    let lastIndex = 0;
    let result = "";

    let match;
    while ((match = tokenRegex.exec(code)) !== null) {
        result += code.slice(lastIndex, match.index);

        const [token, stringToken, colon, boolToken] = match;

        if (stringToken !== undefined) {
            if (colon !== undefined) {
                result += `<span class="json-key">${stringToken}</span>${colon}`;
            } else {
                result += `<span class="json-string">${stringToken}</span>`;
            }
        } else if (boolToken !== undefined) {
            result += `<span class="json-boolean">${boolToken}</span>`;
        } else if (/^-?\d/.test(token)) {
            result += `<span class="json-number">${token}</span>`;
        } else if (/^[{}\[\],:]$/.test(token)) {
            if (token === '{' || token === '}' || token === '[' || token === ']') {
                result += `<span class="json-brace">${token}</span>`;
            } else {
                result += `<span class="json-punct">${token}</span>`;
            }
        } else {
            result += token;
        }

        lastIndex = tokenRegex.lastIndex;
    }

    result += code.slice(lastIndex);

    return result;
}

function parseManualMarkdown(md) {
    md = md.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        if (lang === "json") {
            code = highlightJSON(code);
        } else {
            code = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        return `<pre><code class="code-block lang-${lang}">${code}</code></pre>`;
    });

    md = md.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    md = md.replace(/\*(.+?)\*/g, "<em>$1</em>");

    md = md.replace(/`([^`\n]+?)`/g, "<code class='inline-code'>$1</code>");

    md = md.replace(/\n{2,}/g, "</p><p>");

    md = md.replace(/\n/g, "<br>");

    md = `<p>${md}</p>`;
    return md;
}

function displayApi(api, path) {
    const content = document.getElementById("content");

    let authBadge = "";
    let scopeBlocks = "";
    let disabledBadge = "";

    if (api.auth?.required) {
        authBadge = `<span class="auth-badge">Requires Auth</span>`;
        if (api.auth.scopes?.length) {
            scopeBlocks = `
                <div class="auth-scopes">
                    <b>Permission(s):</b> ${api.auth.scopes.map(scope => `<code class="inline-scope">${scope}</code>`).join(" ")}
                </div>`;
        }
    }

    if (api.disabled) {
        disabledBadge = `<span class="disabled-badge">DISABLED</span>`;
    }

    let headersHtml = "";
    if (api.headers && Object.keys(api.headers).length) {
        headersHtml = `
        <div class="endpoint-section">
            <h2>Headers</h2>
            <div class="param-table-container">
                <table class="param-table">
                    <tr><th>Header</th><th>Value</th></tr>
                    ${Object.entries(api.headers).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
                </table>
            </div>
        </div>`;
    }

    let pathParamsHtml = "";
    if (api.pathParams?.length) {
        pathParamsHtml = `
            <div class="endpoint-section">
                <h2>Path Parameters</h2>
                <div class="param-table-container">
                <table class="param-table">
                    <tr><th>Name</th><th>Description</th></tr>
                    ${api.pathParams.map(p => `<tr><td>${p.name}</td><td>${parseManualMarkdown(p.description)}</td></tr>`).join("")}
                </table>
                </div>
            </div>`;
    }

    let queryHtml = "";
    if (api.query?.length) {
        queryHtml = `
            <div class="endpoint-section">
                <h2>Query Parameters</h2>
                <div class="param-table-container">
                ${api.query.map(q => `
                    <div class="query-param">
                        <h3>${q.name}</h3>
                        <p>${q.description}</p>
                        ${q.values?.length
                ? `<table class="param-table">
                                      <tr><th>Value</th><th>Description</th></tr>
                                      ${q.values.map(v => `<tr><td>${v.value}</td><td>${v.description}</td></tr>`).join("")}
                                  </table>`
                : ""
            }
                    </div>`).join("")}
                </div>
            </div>`;
    }

    let bodyHtml = "";
    if (api.body) {
        let bodyContent = "";

        if (typeof api.body === "object") {
            const jsonString = JSON.stringify(api.body, null, 2);
            const highlighted = highlightJSON(jsonString);
            bodyContent = `<pre><code class="code-block lang-json">${highlighted}</code></pre>`;
        } else {
            bodyContent = `<pre>${api.body}</pre>`;
        }

        bodyHtml = `
        <div class="endpoint-section">
            <h2>Request Body</h2>
            ${bodyContent}
        </div>`;
    }

    let responseHtml = "";
    if (api.response) {
        let responseContent = "";

        if (typeof api.response === "object") {
            const jsonString = JSON.stringify(api.response, null, 2);
            const highlighted = highlightJSON(jsonString);
            responseContent = `<pre><code class="code-block lang-json">${highlighted}</code></pre>`;
        } else {
            responseContent = `<pre>${api.response}</pre>`;
        }

        responseHtml = `
        <div class="endpoint-section">
            <h2>Response Example</h2>
            ${responseContent}
        </div>`;
    }

    let linkedHtml = "";
    if (api.linkedPaths?.length) {
        linkedHtml = `
            <div class="endpoint-section linked-section">
                <h2>Related Documentation</h2>
                <ul>
                    ${api.linkedPaths.map(lp => {
            const last = lp.split("/").pop();
            const item = findItemByPath(lp);
            const emoji = item?.type === "file" ? "📄" : "📁";
            return `<li>
                            <a href="#" class="linked-jump" data-path="${lp}" data-type="${item?.type || "folder"}">
                                ${emoji} ${last}
                            </a>
                        </li>`;
        }).join("")}
                </ul>
            </div>`;
    }

    let notesHtml = "";
    if (api.notes?.length) {
        const parsedNotes = api.notes.map(note => `
  <div class="note-entry">
    ${parseManualMarkdown(note)}
  </div>
`).join("");

        notesHtml = `
        <div class="endpoint-section">
            <h2>Notes</h2>
            <div class="notes-block">
                ${parsedNotes}
            </div>
        </div>`;
    }

    content.innerHTML = `
        <div class="endpoint-container">
            <h1>${api.name}
                <span class="badge badge-${api.request.toLowerCase()}">${api.request}</span>
                ${authBadge}
                ${disabledBadge}
            </h1>
            ${scopeBlocks}
            <p>${api.description}</p>
            ${linkedHtml}
            <div class="endpoint-section">
    <h2>Endpoint URL</h2>
    <pre class="endpoint-url-block">
        <code id="endpoint-link">${api.link}</code>
        <button class="copy-btn" data-copy-text="${api.link}">Copy</button>
    </pre>
</div>
            ${headersHtml}
            ${pathParamsHtml}
            ${queryHtml}
            ${bodyHtml}
            ${notesHtml}
            ${responseHtml}
        </div>`;

    document.querySelectorAll(".linked-jump").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetPath = link.dataset.path;
            const targetType = link.dataset.type;
            const item = findItemByPath(targetPath);
            setActiveSidebar(targetPath);
            if (targetType === "file") {
                displayApi(item, targetPath);
            } else {
                displayFolder(item, targetPath);
            }
        });
    });

    const copyBtn = document.querySelector(".copy-btn");

    if (copyBtn) {
        copyBtn.addEventListener("click", () => {
            const text = copyBtn.getAttribute("data-copy-text");

            // First, try modern clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.textContent = "Copied!";
                    setTimeout(() => {
                        copyBtn.textContent = "Copy";
                    }, 1500);
                }).catch(err => {
                    console.warn("Clipboard API failed, falling back...", err);
                    fallbackCopyText(text);
                });
            } else {
                // Use fallback if insecure context or unsupported
                fallbackCopyText(text);
            }
        });
    }

    // Fallback using a temporary textarea
    function fallbackCopyText(text) {
        const textarea = document.createElement("textarea");
        textarea.value = text;

        // Avoid scrolling to bottom on mobile
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const success = document.execCommand("copy");
            if (success) {
                copyBtn.textContent = "Copied!";
            } else {
                copyBtn.textContent = "Failed";
            }
        } catch (err) {
            console.error("Fallback copy failed:", err);
            copyBtn.textContent = "Error";
        }

        setTimeout(() => {
            copyBtn.textContent = "Copy";
        }, 1500);

        document.body.removeChild(textarea);
    }
}

function findItemByPath(path) {
    const segments = path.split("/");
    let current = apiData.data;
    let item = null;
    for (const seg of segments) {
        item = Array.isArray(current) ? current.find(c => c.name === seg) : current.children.find(c => c.name === seg);
        if (!item) break;
        current = item.children || [];
    }
    return item;
}

function searchItems(query, typeFilter, data = apiData.data, parentPath = "") {
    let results = [];
    data.forEach(item => {
        const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
        const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
        const matchesType =
            typeFilter === "all" ||
            (typeFilter === "file" && item.type === "file") ||
            (typeFilter === "folder" && (!item.type || item.type === "folder"));

        if (matchesQuery && matchesType) {
            results.push({ name: item.name, path: currentPath, type: item.type || "folder" });
        }

        if (item.children) {
            results = results.concat(searchItems(query, typeFilter, item.children, currentPath));
        }
    });
    return results;
}

function displaySearchResults(results) {
    const content = document.getElementById("content");
    content.innerHTML = `
        <h1>Search Results (${results.length})</h1>
        <div class="search-results">
            ${results.length
            ? results.map(r => `
                        <div class="folder-item" data-type="${r.type}" data-path="${r.path}">
                            <span>${r.type === "file" ? "📄" : "📁"}</span>
                            <span class="folder-item-name">${r.name}</span>
                        </div>
                    `).join("")
            : "<p><em>No results found.</em></p>"
        }
        </div>`;

    document.querySelectorAll(".search-results .folder-item").forEach(el => {
        el.addEventListener("click", () => {
            const path = el.dataset.path;
            const type = el.dataset.type;
            const item = findItemByPath(path);

            document.getElementById("searchInput").value = "";
            document.getElementById("searchFilter").value = "all";

            setActiveSidebar(path);

            if (type === "file") {
                displayApi(item, path);
            } else {
                displayFolder(item, path);
            }
        });
    });
}

document.getElementById("searchInput").addEventListener("input", () => {
    const q = document.getElementById("searchInput").value.trim();
    const filter = document.getElementById("searchFilter").value;
    if (!q) {
        document.getElementById("content").innerHTML = "<h1>API Documentation Home</h1>";
        return;
    }
    const results = searchItems(q, filter);
    displaySearchResults(results);
});
document.getElementById("searchFilter").addEventListener("change", () => {
    const q = document.getElementById("searchInput").value.trim();
    const filter = document.getElementById("searchFilter").value;
    if (!q) {
        document.getElementById("content").innerHTML = "<h1>API Documentation Home</h1>";
        return;
    }
    const results = searchItems(q, filter);
    displaySearchResults(results);
});

const sidebar = document.getElementById("sidebar");

const scrollContainer = document.createElement("div");
scrollContainer.className = "scrollable-content";
sidebar.appendChild(scrollContainer);

renderSidebar(apiData.data, scrollContainer);

const homeDiv = document.createElement("div");
homeDiv.id = "sidebar-home";
homeDiv.innerHTML = `
  <a href="home.html" class="home-button">Home</a>
`;
sidebar.appendChild(homeDiv);
